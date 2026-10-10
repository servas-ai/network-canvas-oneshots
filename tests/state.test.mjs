import test from 'node:test';
import assert from 'node:assert/strict';
import { observe } from '../shared/state.mjs';

const now = Date.parse('2026-10-10T12:00:00Z');
const base = { source: 'codex:codex', observedAt: '2026-10-10T11:59:30Z', value: 17 };

test('ready / stale keep value with provenance', () => {
  assert.equal(observe(base, { now }).state, 'ready');
  const s = observe({ ...base, observedAt: '2026-10-10T05:00:00Z' }, { now, maxAgeMs: 6 * 3600e3 });
  assert.equal(s.state, 'stale'); assert.equal(s.value, 17);
});

for (const [name, input] of [
  ['no source', { ...base, source: ' ' }], ['null value', { ...base, value: null }],
  ['impossible date', { ...base, observedAt: '2026-02-30T10:00:00Z' }], ['no zone', { ...base, observedAt: '2026-10-10T11:00:00' }],
  ['future', { ...base, observedAt: '2026-10-11T00:00:00Z' }], ['not object', 'x'],
]) test(`unknown withholds value: ${name}`, () => {
  const o = observe(input, { now });
  assert.equal(o.state, 'unknown'); assert.equal(o.value, null); assert.equal(o.label, 'Unbekannt');
});

test('error beats loading beats data; policy validated', () => {
  assert.equal(observe({ ...base, error: true, loading: true }, { now }).state, 'error');
  assert.equal(observe({ ...base, loading: true }, { now }).state, 'loading');
  assert.equal(observe({ ...base, error: true }, { now }).value, null);
  assert.throws(() => observe(base, { now, maxAgeMs: -1 }), RangeError);
  assert.equal(observe({ ...base, observedAt: '2024-02-29T00:00:00Z' }, { now, maxAgeMs: 1e12 }).state, 'ready');
});
