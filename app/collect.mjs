// SERVAS-2071 local usage collector. Reads ONLY numeric usage fields, model
// names and timestamps from Codex/Claude Code session logs. Prompt/response
// text is never copied; auth/config files are never opened; credit balances
// are dropped. Read-only, streaming, one file at a time (low load).
import { createReadStream } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { homedir } from 'node:os';

export const DEFAULT_ROOTS = Object.freeze({
  codex: join(homedir(), '.codex', 'sessions'),
  claude: join(homedir(), '.claude', 'projects'),
});

async function* jsonlFiles(dir, since) {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* jsonlFiles(path, since);
    else if (entry.isFile() && entry.name.endsWith('.jsonl') && (await stat(path)).mtimeMs >= since) yield path;
  }
}

async function* lines(path, needles) {
  const rl = createInterface({ input: createReadStream(path, { encoding: 'utf8' }), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!needles.some(n => line.includes(n))) continue;
    try { yield JSON.parse(line); } catch { /* partial line while a session writes */ }
  }
}

const n = v => (Number.isFinite(v) && v > 0 ? v : 0);
const iso = v => (typeof v === 'string' && Number.isFinite(Date.parse(v)) ? new Date(Date.parse(v)).toISOString() : null);

// Claude Code prompt sizes (input incl. cache) per request, as a histogram:
// counts only, edges include CCR's default long-context threshold 60000.
export const PROMPT_EDGES = Object.freeze([8000, 32000, 60000, 100000, 200000]);

function makeAgg(sinceMs) {
  return { sinceMs, models: new Map(), days: new Map(), dayRequests: new Map(), hours: Array(24).fill(0), hourRequests: Array(24).fill(0), quotas: new Map(),
    failures: new Map(), recent: [], prompts: PROMPT_EDGES.concat(null).map(upTo => ({ upTo, requests: 0 })),
    sources: { codex: { files: 0, records: 0, observedAt: null }, claude: { files: 0, records: 0, observedAt: null } } };
}

function add(agg, source, model, ts, u) {
  const t = Date.parse(ts);
  if (!Number.isFinite(t) || t < agg.sinceMs) return false;
  const key = `${source}\u0000${model}`;
  const row = agg.models.get(key) ?? { source, model, requests: 0, input: 0, cachedInput: 0, output: 0, reasoning: 0, total: 0 };
  row.requests += 1; row.input += u.input; row.cachedInput += u.cachedInput;
  row.output += u.output; row.reasoning += u.reasoning; row.total += u.total;
  agg.models.set(key, row);
  const day = ts.slice(0, 10);
  agg.days.set(day, (agg.days.get(day) ?? 0) + u.total);
  agg.dayRequests.set(day, (agg.dayRequests.get(day) ?? 0) + 1);
  agg.hours[new Date(t).getUTCHours()] += u.total;
  agg.hourRequests[new Date(t).getUTCHours()] += 1;
  remember(agg, { at: ts, source, model, total: u.total, prompt: u.input + u.cachedInput, status: 'ok' });
  const s = agg.sources[source];
  s.records += 1;
  if (!s.observedAt || ts > s.observedAt) s.observedAt = ts;
  return true;
}

// Newest requests across all sources; files arrive in directory order, so trim
// by time only now and then to keep memory bounded.
const RECENT = 25;
function remember(agg, row) {
  agg.recent.push(row);
  if (agg.recent.length > 20 * RECENT) agg.recent = newest(agg.recent);
}
const newest = rows => rows.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0)).slice(0, RECENT);

// Failed API calls by error class. The class is kept only if it looks like an
// identifier (e.g. authentication_failed, rate_limit); message text is never read.
function fail(agg, source, error, status, ts) {
  const t = Date.parse(ts);
  if (!Number.isFinite(t) || t < agg.sinceMs) return;
  const cls = typeof error === 'string' && /^[a-z][a-z0-9_]{0,39}$/.test(error) ? error : 'unbekannt';
  const code = Number.isInteger(status) && status >= 100 && status < 600 ? status : null;
  const key = `${source}\u0000${cls}\u0000${code}`;
  const row = agg.failures.get(key) ?? { source, error: cls, status: code, count: 0, lastAt: null };
  row.count += 1;
  if (!row.lastAt || ts > row.lastAt) row.lastAt = ts;
  agg.failures.set(key, row);
  remember(agg, { at: ts, source, model: null, total: null, prompt: null, status: cls });
}

export async function collectCodex(agg, root) {
  for await (const file of jsonlFiles(root, agg.sinceMs)) {
    agg.sources.codex.files += 1;
    let model = 'unbekannt', lastTotal = -1;
    for await (const rec of lines(file, ['"turn_context"', '"token_count"'])) {
      const p = rec?.payload ?? {};
      if (rec.type === 'turn_context' && typeof p.model === 'string') { model = p.model; continue; }
      if (p.type !== 'token_count') continue;
      const ts = iso(rec.timestamp);
      if (!ts) continue;
      const total = p.info?.total_token_usage?.total_tokens;
      const last = p.info?.last_token_usage;
      // token_count repeats after each turn; count only when the cumulative total advances.
      if (last && Number.isFinite(total) && total > lastTotal) {
        lastTotal = total;
        const input = n(last.input_tokens), cachedInput = n(last.cached_input_tokens);
        add(agg, 'codex', model, ts, { input: input - Math.min(input, cachedInput), cachedInput,
          output: n(last.output_tokens), reasoning: n(last.reasoning_output_tokens), total: n(last.total_tokens) });
      }
      const rl = p.rate_limits;
      if (rl && typeof rl === 'object') {
        const id = typeof rl.limit_id === 'string' ? rl.limit_id : 'codex';
        const prev = agg.quotas.get(id);
        if (!prev || ts > prev.observedAt) {
          const windows = ['primary', 'secondary'].flatMap(name => {
            const w = rl[name];
            if (!w || typeof w !== 'object') return [];
            return [{ name, usedPercent: Number.isFinite(w.used_percent) ? w.used_percent : null,
              windowMinutes: Number.isFinite(w.window_minutes) ? w.window_minutes : null,
              resetsAt: Number.isFinite(w.resets_at) ? new Date(w.resets_at * 1000).toISOString() : null }];
          });
          agg.quotas.set(id, { source: 'codex', limitId: id, plan: typeof rl.plan_type === 'string' ? rl.plan_type : null,
            limitReached: rl.rate_limit_reached_type ?? null, observedAt: ts, windows });
        }
      }
    }
  }
}

export async function collectClaude(agg, root) {
  const seen = new Set();
  for await (const file of jsonlFiles(root, agg.sinceMs)) {
    agg.sources.claude.files += 1;
    for await (const rec of lines(file, ['"usage"', '"isApiErrorMessage"'])) {
      const m = rec?.message;
      const u = m?.usage;
      if (rec?.isApiErrorMessage === true) {
        // Claude Code logs a failed call as a synthetic assistant line, once per line uuid.
        const ts = iso(rec.timestamp), id = rec.uuid ?? m?.id;
        if (ts && id && !seen.has(id)) { seen.add(id); fail(agg, 'claude', rec.error, rec.apiErrorStatus, ts); }
        continue;
      }
      if (rec.type !== 'assistant' || !u || typeof m.model !== 'string' || m.model.startsWith('<')) continue;
      // Claude Code writes one line per content block with identical usage; dedupe per API message.
      const id = m.id ?? rec.requestId ?? rec.uuid;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const ts = iso(rec.timestamp);
      if (!ts) continue;
      const input = n(u.input_tokens) + n(u.cache_creation_input_tokens), cachedInput = n(u.cache_read_input_tokens);
      const output = n(u.output_tokens);
      if (add(agg, 'claude', m.model, ts, { input, cachedInput, output,
        reasoning: n(u.output_tokens_details?.thinking_tokens), total: input + cachedInput + output })) {
        agg.prompts.find(b => b.upTo === null || input + cachedInput <= b.upTo).requests += 1;
      }
    }
  }
}

// Every UTC day of the window, so empty days stay visible as zero on the axis.
export function dayRange(sinceMs, now) {
  const out = [];
  const start = new Date(sinceMs);
  start.setUTCHours(0, 0, 0, 0);
  for (let t = start.getTime(); t <= now; t += 86400000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

export async function collectUsage({ days = 30, now = Date.now(), roots = DEFAULT_ROOTS } = {}) {
  const span = Math.max(1, Math.min(365, Math.trunc(days) || 30));
  const agg = makeAgg(now - span * 86400000);
  if (roots.codex) await collectCodex(agg, roots.codex);
  if (roots.claude) await collectClaude(agg, roots.claude);
  const byModel = [...agg.models.values()].sort((a, b) => b.total - a.total);
  const totals = byModel.reduce((t, r) => {
    for (const k of ['requests', 'input', 'cachedInput', 'output', 'reasoning', 'total']) t[k] += r[k];
    return t;
  }, { requests: 0, input: 0, cachedInput: 0, output: 0, reasoning: 0, total: 0 });
  return {
    generatedAt: new Date(now).toISOString(),
    windowDays: span,
    sources: Object.entries(agg.sources).map(([id, s]) => ({ id, ...s })),
    totals,
    byModel,
    byDay: dayRange(agg.sinceMs, now).map(day => ({ day, total: agg.days.get(day) ?? 0, requests: agg.dayRequests.get(day) ?? 0 })),
    byHourUtc: agg.hours,
    requestsByHourUtc: agg.hourRequests,
    quotas: [...agg.quotas.values()],
    // Only Claude Code writes failed calls into its session log; for Codex the
    // failure count is unknown, not zero.
    failureLogging: { claude: true, codex: false },
    failures: [...agg.failures.values()].sort((a, b) => b.count - a.count),
    recent: newest(agg.recent),
    claudePrompts: agg.prompts,
  };
}
