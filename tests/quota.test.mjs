import test from 'node:test';
import assert from 'node:assert/strict';
import { quotaWindow, trayModel, level, PROVIDERS } from '../shared/quota.mjs';

const now = Date.parse('2026-10-10T22:00:00Z');
const q = { source: 'codex', limitId: 'codex', plan: 'pro', observedAt: '2026-10-10T21:30:00Z',
  windows: [{ name: 'primary', usedPercent: 34, windowMinutes: 300, resetsAt: '2026-10-11T00:18:00Z' },
    { name: 'secondary', usedPercent: 62, windowMinutes: 10080, resetsAt: '2026-10-14T03:31:58Z' }] };

test('fresh window is ready with remaining time and level', () => {
  const w = quotaWindow(q, q.windows[0], { now });
  assert.equal(w.obs.state, 'ready'); assert.equal(w.obs.value, 34);
  assert.equal(w.remainingMs, 138 * 60e3); assert.equal(w.level, 'ok');
  assert.deepEqual([level(69.9), level(70), level(90), level(null)], ['ok', 'warn', 'bad', null]);
});

test('passed reset withholds the old percentage', () => {
  const w = quotaWindow(q, { ...q.windows[0], resetsAt: '2026-10-10T21:59:59Z' }, { now });
  assert.equal(w.expired, true); assert.equal(w.obs.state, 'unknown'); assert.equal(w.obs.value, null);
  assert.equal(w.remainingMs, null); assert.equal(w.level, null);
});

test('old observation stays visible as stale, missing provenance is unknown', () => {
  assert.equal(quotaWindow({ ...q, observedAt: '2026-10-10T01:53:52Z' }, q.windows[1], { now }).obs.state, 'stale');
  for (const bad of [{ ...q, observedAt: '2026-02-30T10:00:00Z' }, { ...q, observedAt: null }, { ...q, limitId: '' },
    { ...q, observedAt: '2026-10-11T10:00:00Z' }]) {
    assert.equal(quotaWindow(bad, q.windows[1], { now }).obs.value, null, JSON.stringify(bad.observedAt));
  }
  assert.equal(quotaWindow(q, { ...q.windows[0], usedPercent: 'x' }, { now }).obs.state, 'unknown');
});

test('tray model: every catalogue provider present, only codex has an adapter', () => {
  const m = trayModel([q], { now });
  assert.deepEqual(m.providers.map(p => p.id), PROVIDERS.map(p => p.id));
  assert.equal(m.worst, 62); assert.equal(m.covered, 1); assert.equal(m.total, 5);
  const [codex, ...rest] = m.providers;
  assert.equal(codex.state, 'ready'); assert.equal(codex.accounts.length, 1);
  for (const p of rest) { assert.equal(p.state, 'unknown'); assert.equal(p.worst, null); assert.ok(p.reason); }
});

test('tray model: nothing invented without data', () => {
  for (const input of [[], undefined, null, [{ source: 'codex', limitId: 'codex', observedAt: null, windows: q.windows }]]) {
    const m = trayModel(input, { now });
    assert.equal(m.worst, null); assert.equal(m.covered, 0);
    assert.ok(m.providers.every(p => p.state === 'unknown'));
  }
  const stale = trayModel([{ ...q, observedAt: '2026-10-10T01:53:52Z' }], { now });
  assert.equal(stale.providers[0].state, 'stale'); assert.equal(stale.worst, 62);
});

test('fmt.remaining countdown', async () => {
  globalThis.document ??= undefined;
  const { fmt } = await import('../shared/components.mjs');
  assert.deepEqual([3 * 86400e3 + 5 * 3600e3 + 59e3, 138 * 60e3, 18 * 60e3 + 30e3, 30e3, -1, NaN].map(fmt.remaining),
    ['3 T 5 h', '2 h 18 min', '18 min', '< 1 min', '–', '–']);
});
