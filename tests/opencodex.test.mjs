import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { readCatalog, probePort } from '../app/opencodex.mjs';
import { trayModel, poolCapacity } from '../shared/quota.mjs';
import { dayCompare } from '../shared/usage.mjs';

const fx = fileURLToPath(new URL('fixtures/opencodex/models_cache.json', import.meta.url));

test('catalog: whitelisted fields, sorted by priority, no identity or instructions', async () => {
  const c = await readCatalog(fx);
  assert.equal(c.fetchedAt, '2026-10-11T02:03:11.048Z');
  assert.equal(c.clientVersion, '0.160.0');
  assert.deepEqual(c.models.map(m => m.slug), ['m-first', 'm-second']);
  assert.deepEqual(c.models[1], { slug: 'm-second', name: 'M Second', visibility: 'list', priority: 2, defaultEffort: 'medium', efforts: ['low', 'medium'], api: true });
  const json = JSON.stringify(c);
  for (const leak of ['IDENTITY-SHOULD-NOT-LEAK', 'INSTRUCTIONS-SHOULD-NOT-LEAK', 'etag']) assert.ok(!json.includes(leak), leak);
  assert.equal(await readCatalog('/nonexistent/models_cache.json'), null);
});

test('gateway probe: open port reachable, closed port not', async () => {
  const srv = createServer(s => s.destroy());
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const { port } = srv.address();
  const open = await probePort(port);
  assert.equal(open.reachable, true); assert.ok(open.latencyMs >= 0); assert.ok(Date.parse(open.checkedAt));
  await new Promise(r => srv.close(r));
  const closed = await probePort(port);
  assert.equal(closed.reachable, false); assert.equal(closed.latencyMs, null);
});

test('pool capacity: free share of the most used window; unknown or stale windows do not count as free', () => {
  const now = Date.parse('2026-10-11T02:00:00Z');
  const q = (limitId, used) => ({ source: 'codex', limitId, observedAt: '2026-10-11T01:00:00Z',
    windows: [{ name: 'primary', usedPercent: 20, windowMinutes: 300, resetsAt: '2026-10-11T05:00:00Z' },
      { name: 'secondary', usedPercent: used, windowMinutes: 10080, resetsAt: '2026-10-15T00:00:00Z' }] });
  assert.deepEqual({ ...poolCapacity(trayModel([q('a', 60)], { now })) }, { accounts: 1, known: 1, available: 40 });
  assert.deepEqual({ ...poolCapacity(trayModel([q('a', 60), q('b', null)], { now })) }, { accounts: 2, known: 1, available: 40 });
  const stale = { ...q('c', 10), observedAt: '2026-10-10T01:00:00Z' };
  assert.deepEqual({ ...poolCapacity(trayModel([stale], { now })) }, { accounts: 1, known: 0, available: null });
  assert.deepEqual({ ...poolCapacity(trayModel([], { now })) }, { accounts: 0, known: 0, available: null });
});

test('dayCompare by requests; payload without the field stays null', () => {
  assert.deepEqual({ ...dayCompare([{ day: 'a', total: 9, requests: 4 }, { day: 'b', total: 3, requests: 2 }], 'requests') }, { day: 'b', today: 2, yesterday: 4 });
  assert.deepEqual({ ...dayCompare([{ day: 'a', total: 9 }, { day: 'b', total: 3 }], 'requests') }, { day: 'b', today: null, yesterday: null });
});
