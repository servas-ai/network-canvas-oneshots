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
