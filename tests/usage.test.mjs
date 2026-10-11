import test from 'node:test';
import assert from 'node:assert/strict';
import { cacheRate, dayCompare, rollingHours, shares } from '../shared/usage.mjs';

test('cache rate is null without input, never 0 %', () => {
  assert.equal(cacheRate({ input: 0, cachedInput: 0 }), null);
  assert.equal(cacheRate(undefined), null);
  assert.equal(cacheRate({ input: 25, cachedInput: 75 }), 75);
});

test('day compare reports raw values and keeps missing days unknown', () => {
  assert.deepEqual({ ...dayCompare([{ day: '2026-10-10', total: 9 }, { day: '2026-10-11', total: 3 }]) },
    { day: '2026-10-11', today: 3, yesterday: 9 });
  assert.deepEqual({ ...dayCompare([{ day: '2026-10-11', total: 0 }]) }, { day: '2026-10-11', today: 0, yesterday: null });
  assert.deepEqual({ ...dayCompare([]) }, { day: null, today: null, yesterday: null });
});

test('rolling hours end with the current UTC hour', () => {
  const hours = Array.from({ length: 24 }, (_, h) => h * 10);
  const r = rollingHours(hours, Date.parse('2026-10-11T05:30:00Z'));
  assert.equal(r.length, 24);
  assert.equal(r[0].hour, 6); assert.equal(r.at(-1).hour, 5); assert.equal(r.at(-1).value, 50);
  assert.deepEqual(rollingHours([1, 2]), []);
});

test('shares group by key, sort by tokens and sum to 100', () => {
  const rows = [{ source: 'codex', model: 'a', requests: 1, total: 30, cachedInput: 5 },
    { source: 'claude', model: 'b', requests: 2, total: 50, cachedInput: 0 },
    { source: 'codex', model: 'c', requests: 1, total: 20, cachedInput: 1 }];
  const s = shares(rows, 'source');
  assert.deepEqual(s.map(g => [g.label, g.total, g.requests, g.share]), [['codex', 50, 2, 50], ['claude', 50, 2, 50]]);
  assert.deepEqual(shares(rows).map(g => g.label), ['b', 'a', 'c']);
  assert.equal(shares([{ model: 'x', requests: 0, total: 0, cachedInput: 0 }])[0].share, null);
});

test('coverage: names days before the first log entry, never invents data', async () => {
  const { coverage } = await import('../shared/usage.mjs');
  const day = (d, total, requests = total ? 1 : 0) => ({ day: `2026-10-${String(d).padStart(2, '0')}`, total, requests });
  const month = [...Array.from({ length: 26 }, (_, i) => day(i + 1, 0)), day(27, 5), day(28, 0), day(29, 9), day(30, 1)];
  assert.deepEqual({ ...coverage(month) }, { days: 30, covered: 4, firstDay: '2026-10-27' });
  assert.deepEqual({ ...coverage([day(1, 3), day(2, 0)]) }, { days: 2, covered: 2, firstDay: '2026-10-01' }, 'gap after first entry is not missing coverage');
  assert.deepEqual({ ...coverage([day(1, 0), day(2, 0)]) }, { days: 2, covered: 0, firstDay: null });
  assert.deepEqual({ ...coverage([{ day: '2026-10-01', total: 0, requests: 2 }]) }, { days: 1, covered: 1, firstDay: '2026-10-01' }, 'requests without tokens count');
  assert.deepEqual({ ...coverage() }, { days: 0, covered: 0, firstDay: null });
});
