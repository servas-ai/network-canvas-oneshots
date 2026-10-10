import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { collectUsage, dayRange } from '../app/collect.mjs';

const fx = p => fileURLToPath(new URL(`fixtures/${p}`, import.meta.url));
const roots = { codex: fx('codex'), claude: fx('claude') };
const now = Date.parse('2026-10-10T00:00:00Z');

test('codex: counts only advancing cumulative totals, keeps latest quota', async () => {
  const d = await collectUsage({ days: 30, now, roots: { codex: roots.codex } });
  const row = d.byModel.find(r => r.model === 'gpt-test');
  assert.deepEqual({ ...row }, { source: 'codex', model: 'gpt-test', requests: 2, input: 80, cachedInput: 40, output: 60, reasoning: 10, total: 180 });
  assert.equal(d.quotas.length, 1);
  assert.equal(d.quotas[0].windows[0].usedPercent, 13);
  assert.equal(d.quotas[0].windows[0].windowMinutes, 10080);
  assert.equal(d.quotas[0].observedAt, '2026-10-09T10:00:03.000Z');
});

test('claude: dedupes per message id, skips synthetic and out-of-window', async () => {
  const d = await collectUsage({ days: 30, now, roots: { claude: roots.claude } });
  assert.equal(d.byModel.length, 1);
  assert.deepEqual({ ...d.byModel[0] }, { source: 'claude', model: 'claude-test', requests: 1, input: 105, cachedInput: 1000, output: 20, reasoning: 7, total: 1125 });
});

test('output never carries prompt text, paths or credit balances', async () => {
  const json = JSON.stringify(await collectUsage({ days: 30, now, roots }));
  for (const leak of ['PROMPT-SHOULD-NOT-LEAK', '/secret/path', '99999', 'balance']) assert.ok(!json.includes(leak), leak);
});

test('totals, hours and contiguous day axis', async () => {
  const d = await collectUsage({ days: 7, now, roots });
  assert.equal(d.totals.total, 1305);
  assert.equal(d.byHourUtc[10], 150); assert.equal(d.byHourUtc[11], 30); assert.equal(d.byHourUtc[12], 1125);
  assert.equal(d.byDay.length, 8);
  assert.equal(d.byDay.find(x => x.day === '2026-10-09').total, 1305);
  assert.equal(d.byDay.filter(x => x.total === 0).length, 7);
  assert.deepEqual(dayRange(Date.parse('2024-02-28T23:00:00Z'), Date.parse('2024-03-01T01:00:00Z')), ['2024-02-28', '2024-02-29', '2024-03-01']);
});

test('missing roots and invalid window degrade to empty data', async () => {
  const d = await collectUsage({ days: 'x', now, roots: { codex: fx('nope'), claude: fx('nope') } });
  assert.equal(d.windowDays, 30); assert.equal(d.totals.total, 0); assert.deepEqual(d.quotas, []);
});
