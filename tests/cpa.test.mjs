import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { collectUsage } from '../app/collect.mjs';
import { collectGateways } from '../app/gateways.mjs';
import { successRate, failureClasses } from '../shared/usage.mjs';

const fx = p => fileURLToPath(new URL(`fixtures/${p}`, import.meta.url));
const roots = { codex: fx('codex'), claude: fx('claude') };
const now = Date.parse('2026-10-10T00:00:00Z');

test('failed claude calls: one per uuid, in window, class whitelisted, no message text', async () => {
  const d = await collectUsage({ days: 30, now, roots });
  assert.deepEqual(d.failures.map(f => ({ ...f })), [
    { source: 'claude', error: 'authentication_failed', status: null, count: 1, lastAt: '2026-10-09T12:06:00.000Z' },
    { source: 'claude', error: 'unbekannt', status: 429, count: 1, lastAt: '2026-10-09T12:07:00.000Z' },
  ]);
  assert.deepEqual(d.failureLogging, { claude: true, codex: false });
  assert.equal(d.byModel.filter(r => r.source === 'claude').length, 1, 'failures are not usage rows');
  assert.ok(!JSON.stringify(d).includes('PROMPT-SHOULD-NOT-LEAK'));
});

test('recent: newest first across sources, failures included, bounded', async () => {
  const d = await collectUsage({ days: 30, now, roots });
  assert.deepEqual(d.recent.map(r => [r.at, r.source, r.status]), [
    ['2026-10-09T12:07:00.000Z', 'claude', 'unbekannt'],
    ['2026-10-09T12:06:00.000Z', 'claude', 'authentication_failed'],
    ['2026-10-09T12:00:01.000Z', 'claude', 'ok'],
    ['2026-10-09T11:00:00.000Z', 'codex', 'ok'],
    ['2026-10-09T10:00:02.000Z', 'codex', 'ok'],
  ]);
  assert.deepEqual(Object.keys(d.recent[2]).sort(), ['at', 'model', 'prompt', 'source', 'status', 'total']);
  assert.ok(d.recent.length <= 25);
});

test('success rate: claude from logged failures, codex unknown never 100 %', async () => {
  const d = await collectUsage({ days: 30, now, roots });
  const c = successRate(d, 'claude');
  assert.deepEqual({ ...c }, { ok: 1, failed: 2, rate: (1 / 3) * 100 });
  assert.deepEqual({ ...successRate(d, 'codex') }, { ok: null, failed: null, rate: null });
  assert.equal(successRate({ failureLogging: { claude: true }, byModel: [], failures: [] }, 'claude').rate, null);
  assert.equal(successRate({ byModel: [{ source: 'claude', requests: 5 }] }, 'claude').rate, null, 'payload without failureLogging');
});

test('failure classes merge sources, status prefix, largest first', () => {
  const rows = failureClasses([
    { source: 'claude', error: 'rate_limit', status: 429, count: 2, lastAt: '2026-10-09T01:00:00Z' },
    { source: 'codex', error: 'rate_limit', status: 429, count: 3, lastAt: '2026-10-09T02:00:00Z' },
    { source: 'claude', error: 'authentication_failed', status: null, count: 4, lastAt: '2026-10-08T00:00:00Z' },
  ]);
  assert.deepEqual(rows.map(r => ({ ...r })), [
    { label: '429 · rate_limit', count: 5, lastAt: '2026-10-09T02:00:00Z' },
    { label: 'authentication_failed', count: 4, lastAt: '2026-10-08T00:00:00Z' },
  ]);
});

test('gateways: mockup ports, env override, probe only', async () => {
  const seen = [];
  const g = await collectGateways({ env: { CPA_PORT: '9999' }, probe: async port => (seen.push(port), { host: '127.0.0.1', port, reachable: false, latencyMs: null, checkedAt: 'x' }) });
  assert.deepEqual(seen, [9999, 10100]);
  assert.deepEqual(g.nodes.map(n => [n.id, n.port]), [['cliproxyapi', 9999], ['opencodex', 10100]]);
});
