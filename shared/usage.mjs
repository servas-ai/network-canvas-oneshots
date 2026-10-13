// SERVAS-2071 shared usage analytics for /api/usage payloads (usage/, later
// others). Pure, no I/O. Ratios without a denominator stay null (UNKNOWN),
// never 0 %, so the UI cannot show an invented rate.

// Share of cached input in all input the provider saw.
export function cacheRate(t) {
  const seen = (t?.input ?? 0) + (t?.cachedInput ?? 0);
  return seen > 0 ? (t.cachedInput / seen) * 100 : null;
}

// Today (UTC, still running) vs. the full previous UTC day. No percentage
// delta: a partial day against a full day would read as a drop. key: 'total'
// (tokens) or 'requests'; a payload without that field yields null, not 0.
export function dayCompare(byDay = [], key = 'total') {
  const today = byDay.at(-1) ?? null, prev = byDay.at(-2) ?? null;
  const val = d => (d && Number.isFinite(d[key]) ? d[key] : null);
  return Object.freeze({ day: today?.day ?? null, today: val(today), yesterday: val(prev) });
}

// Rolling 24 h ending in the current UTC hour: byHourUtc is indexed by UTC
// clock hour, so rotate it to put the hour after `now` first.
export function rollingHours(byHourUtc = [], now = Date.now()) {
  if (byHourUtc.length !== 24) return [];
  const start = (new Date(now).getUTCHours() + 1) % 24;
  return Array.from({ length: 24 }, (_, i) => {
    const h = (start + i) % 24;
    return Object.freeze({ hour: h, label: `${String(h).padStart(2, '0')} UTC`, value: byHourUtc[h] ?? 0 });
  });
}

// Group model rows (byModel) by key, with share of total tokens.
export function shares(rows = [], key = 'model') {
  const groups = new Map();
  for (const r of rows) {
    const g = groups.get(r[key]) ?? { label: r[key], requests: 0, total: 0, cachedInput: 0 };
    g.requests += r.requests; g.total += r.total; g.cachedInput += r.cachedInput;
    groups.set(r[key], g);
  }
  const sum = [...groups.values()].reduce((s, g) => s + g.total, 0);
  return [...groups.values()].sort((a, b) => b.total - a.total)
    .map(g => Object.freeze({ ...g, share: sum > 0 ? (g.total / sum) * 100 : null }));
}

// Success rate of one source: ok calls vs. failed calls in the same window.
// Sources that do not log failures (failureLogging false) stay null, so a
// missing failure log can never read as 100 %.
export function successRate(data, source) {
  if (data?.failureLogging?.[source] !== true) return Object.freeze({ ok: null, failed: null, rate: null });
  const ok = (data.byModel ?? []).filter(r => r.source === source).reduce((s, r) => s + r.requests, 0);
  const failed = (data.failures ?? []).filter(f => f.source === source).reduce((s, f) => s + f.count, 0);
  return Object.freeze({ ok, failed, rate: ok + failed > 0 ? (ok / (ok + failed)) * 100 : null });
}

// Failure classes summed over sources, largest first.
export function failureClasses(failures = []) {
  const groups = new Map();
  for (const f of failures) {
    const key = f.status === null ? f.error : `${f.status} · ${f.error}`;
    const g = groups.get(key) ?? { label: key, count: 0, lastAt: null };
    g.count += f.count;
    if (!g.lastAt || f.lastAt > g.lastAt) g.lastAt = f.lastAt;
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => b.count - a.count).map(g => Object.freeze(g));
}

// How much of a byDay window has log data: days from the first day with any
// activity to the end. Earlier empty days cannot tell "no use" from "no logs",
// so the UI names the gap instead of reading it as a quiet month.
export function coverage(byDay = []) {
  const first = byDay.findIndex(d => (d.total ?? 0) > 0 || (d.requests ?? 0) > 0);
  return Object.freeze({
    days: byDay.length,
    covered: first < 0 ? 0 : byDay.length - first,
    firstDay: first < 0 ? null : byDay[first].day,
  });
}
