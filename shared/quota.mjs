// SERVAS-2071 shared quota logic for every surface that shows account windows
// (live/, tray/). Pure, no I/O. A window value is shown only through
// shared/state.mjs observe(): no source/timestamp -> unknown, old -> stale,
// reset already passed -> unknown (the old percentage no longer applies).
import { observe } from './state.mjs';

export const QUOTA_MAX_AGE = 6 * 3600e3; // Codex refreshes rate_limits per turn

// Provider catalogue of the CLIProxy Quota Tray mockup. `adapter` names the
// real data path; null means there is none yet and the row stays unknown.
export const PROVIDERS = Object.freeze([
  Object.freeze({ id: 'codex', label: 'ChatGPT · Codex', adapter: 'local-codex-rate-limits' }),
  Object.freeze({ id: 'claude', label: 'Claude · Claude Code', adapter: null,
    reason: 'Claude-Code-Session-Logs enthalten keine Quota-Fenster.' }),
  Object.freeze({ id: 'gemini', label: 'Gemini', adapter: null, reason: 'Kein Adapter.' }),
  Object.freeze({ id: 'grok', label: 'Grok', adapter: null, reason: 'Kein Adapter.' }),
  Object.freeze({ id: 'cliproxy', label: 'CLIProxy-Pool', adapter: null,
    reason: 'Management-API braucht einen Management-Key – menschliche Freigabe nötig.' }),
]);

export function level(percent) {
  if (!Number.isFinite(percent)) return null;
  return percent >= 90 ? 'bad' : percent >= 70 ? 'warn' : 'ok';
}

export function quotaWindow(q, w, { now = Date.now(), maxAgeMs = QUOTA_MAX_AGE } = {}) {
  const reset = typeof w?.resetsAt === 'string' ? Date.parse(w.resetsAt) : NaN;
  const expired = Number.isFinite(reset) && reset <= now;
  const obs = observe({ source: q?.source && q?.limitId ? `${q.source}:${q.limitId}` : null, observedAt: q?.observedAt,
    value: expired || !Number.isFinite(w?.usedPercent) ? null : w.usedPercent }, { now, maxAgeMs });
  return Object.freeze({ name: w?.name ?? null, windowMinutes: Number.isFinite(w?.windowMinutes) ? w.windowMinutes : null,
    obs, expired, resetsAt: Number.isFinite(reset) ? w.resetsAt : null,
    remainingMs: Number.isFinite(reset) && !expired ? reset - now : null, level: level(obs.value) });
}

// One row per catalogue provider; quotas come from /api/usage `quotas`.
export function trayModel(quotas = [], { now = Date.now(), maxAgeMs = QUOTA_MAX_AGE } = {}) {
  const providers = PROVIDERS.map(p => {
    const accounts = (Array.isArray(quotas) ? quotas : []).filter(q => q && q.source === p.id).map(q => Object.freeze({
      limitId: q.limitId, plan: typeof q.plan === 'string' ? q.plan : null, observedAt: q.observedAt ?? null,
      limitReached: q.limitReached ?? null,
      windows: (Array.isArray(q.windows) ? q.windows : []).map(w => quotaWindow(q, w, { now, maxAgeMs })) }));
    const windows = accounts.flatMap(a => a.windows);
    const shown = windows.filter(w => w.obs.value !== null);
    const state = shown.some(w => w.obs.state === 'ready') ? 'ready' : shown.length ? 'stale' : 'unknown';
    return Object.freeze({ ...p, accounts, state, worst: shown.length ? Math.max(...shown.map(w => w.obs.value)) : null });
  });
  const known = providers.filter(p => p.worst !== null);
  return Object.freeze({ providers, worst: known.length ? Math.max(...known.map(p => p.worst)) : null,
    covered: known.length, total: providers.length });
}
