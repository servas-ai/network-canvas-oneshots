import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { collectUsage, PROMPT_EDGES } from '../app/collect.mjs';
import { readRouterConfig, collectRouter, parseRule, DEFAULT_PORT } from '../app/router.mjs';
import { createUsageServer } from '../app/server.mjs';
import { routeFor, aboveThreshold, ruleHits, threshold, share, CCR_THRESHOLD } from '../shared/route.mjs';

const fx = p => fileURLToPath(new URL(`fixtures/${p}`, import.meta.url));
const now = Date.parse('2026-10-10T00:00:00Z');
const usage = () => collectUsage({ days: 30, now, roots: { claude: fx('claude-router') } });
const probe = async port => ({ host: '127.0.0.1', port, reachable: false, latencyMs: null, checkedAt: '2026-10-10T00:00:00.000Z' });

test('config: only routing facts survive, keys, URLs and options never leave', async () => {
  const c = await readRouterConfig(fx('ccr/config.json'));
  assert.equal(c.valid, true);
  assert.equal(c.port, 3457); assert.equal(c.timeoutMs, 600000); assert.equal(c.longContextThreshold, 60000);
  assert.deepEqual(c.rules, {
    default: { provider: 'deepseek', model: 'deepseek-chat' },
    background: { provider: 'deepseek', model: 'deepseek-chat' },
    think: { provider: 'deepseek', model: 'deepseek-reasoner' },
    longContext: { provider: 'openrouter', model: 'google/gemini-2.5-pro-preview' },
    webSearch: null, // URL + key + extra field is not "provider,model"
  });
  assert.deepEqual(c.providers, [
    { name: 'openrouter', models: ['google/gemini-2.5-pro-preview', 'anthropic/claude-sonnet-4'], transformers: ['openrouter', 'maxtoken'] },
    { name: 'deepseek', models: ['deepseek-chat', 'deepseek-reasoner'], transformers: ['deepseek'] },
  ]);
  const json = JSON.stringify(c);
  for (const leak of ['SECRET', 'OPTION-SHOULD-NOT-LEAK', 'api_key', 'api_base_url', 'APIKEY', 'deepseek.com']) assert.ok(!json.includes(leak), leak);
});

test('config: missing file is null, broken JSON is invalid without content', async () => {
  assert.equal(await readRouterConfig(fx('ccr/none.json')), null);
  const b = await readRouterConfig(fx('ccr/broken.json'));
  assert.equal(b.valid, false); assert.deepEqual(Object.keys(b).sort(), ['modifiedAt', 'valid']);
});

test('parseRule accepts provider,model only', () => {
  assert.deepEqual(parseRule('anthropic,claude-sonnet-4.6'), { provider: 'anthropic', model: 'claude-sonnet-4.6' });
  for (const bad of ['anthropic', 'a,b,c', 'https://x.y,z', 'a b,c', '', null, 42, `a,${'m'.repeat(81)}`]) assert.equal(parseRule(bad), null, String(bad));
});

test('collectRouter probes config port, env wins, default 3456 without config', async () => {
  const seen = [];
  const p = async port => (seen.push(port), probe(port));
  assert.equal((await collectRouter({ configPath: fx('ccr/config.json'), env: {}, probe: p })).service.port, 3457);
  assert.equal((await collectRouter({ configPath: fx('ccr/config.json'), env: { CCR_PORT: '4000' }, probe: p })).service.port, 4000);
  const none = await collectRouter({ configPath: fx('ccr/none.json'), env: {}, probe: p });
  assert.equal(none.config, null); assert.equal(none.service.port, DEFAULT_PORT);
  assert.deepEqual(seen, [3457, 4000, 3456]);
});

test('collector: prompt histogram with 60000 edge, prompt per recent row, no text', async () => {
  const d = await usage();
  assert.ok(PROMPT_EDGES.includes(CCR_THRESHOLD));
  assert.deepEqual(d.claudePrompts.map(b => [b.upTo, b.requests]), [[8000, 1], [32000, 0], [60000, 1], [100000, 2], [200000, 0], [null, 1]]);
  assert.deepEqual(d.recent.map(r => [r.model, r.prompt]).reverse(),
    [['claude-opus-5-5', 60000], ['claude-opus-5-5', 70000], ['claude-haiku-4-5', 2000], ['claude-haiku-4-5', 90000], ['claude-opus-5-5', 250001]]);
  assert.ok(!JSON.stringify(d).includes('PROMPT-SHOULD-NOT-LEAK'));
});

test('routeFor follows CCR order: long context, then haiku background, else default', () => {
  const all = { longContext: {}, background: {} };
  assert.equal(routeFor({ model: 'claude-opus-5-5', prompt: 60000 }, all), 'default', 'threshold itself is not long');
  assert.equal(routeFor({ model: 'claude-opus-5-5', prompt: 60001 }, all), 'longContext');
  assert.equal(routeFor({ model: 'claude-haiku-4-5', prompt: 90000 }, all), 'longContext', 'long wins over background');
  assert.equal(routeFor({ model: 'claude-haiku-4-5', prompt: 2000 }, all), 'background');
  assert.equal(routeFor({ model: 'claude-haiku-4-5', prompt: 90000 }, {}), 'default', 'unconfigured rules fall through');
  assert.equal(routeFor({ model: 'claude-opus-5-5', prompt: 70000 }, all, 80000), 'default', 'config threshold');
  assert.equal(routeFor({ model: 'x', prompt: null }, all), null, 'no prompt size, no route');
});

test('aboveThreshold is exact on edges and unknown between them', async () => {
  const { claudePrompts: b } = await usage();
  assert.equal(aboveThreshold(b, 60000), 3);
  assert.equal(aboveThreshold(b, 100000), 1);
  assert.equal(aboveThreshold(b, 70000), null, 'no estimate between edges');
  assert.equal(aboveThreshold([], 60000), null);
  assert.equal(share(3, b), 60); assert.equal(share(null, b), null); assert.equal(share(1, []), null);
  assert.equal(threshold(null), 60000); assert.equal(threshold({ longContextThreshold: 100000 }), 100000);
});

test('ruleHits: overlap of long haiku requests makes default/background unknown, not guessed', async () => {
  const d = await usage();
  const c = await readRouterConfig(fx('ccr/config.json'));
  const h = ruleHits(d, c);
  assert.equal(h.requests, 5);
  assert.deepEqual(h.hits, { default: 5, background: 2, think: null, longContext: 3, webSearch: null });
  assert.deepEqual(h.routed, { default: null, background: null, think: null, longContext: 3, webSearch: null });
  // without background rule there is no overlap: exact split
  const noBg = { ...c, rules: { ...c.rules, background: null } };
  assert.deepEqual(ruleHits(d, noBg).routed, { default: 2, background: 0, think: null, longContext: 3, webSearch: null });
  // no config: everything goes to default, matches are still shown
  assert.deepEqual(ruleHits(d, null).routed, { default: 5, background: 0, think: null, longContext: 0, webSearch: null });
  assert.deepEqual(ruleHits(d, { valid: false }).routed.default, 5);
  // a threshold between edges: long-context count unknown, default too
  const odd = ruleHits(d, { ...noBg, longContextThreshold: 70000 });
  assert.equal(odd.hits.longContext, null); assert.equal(odd.routed.default, null);
});

test('api/router is cached briefly and read-only; /router redirects', async () => {
  let calls = 0;
  const server = createUsageServer({ router: async () => ({ n: ++calls }) });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.deepEqual(await (await fetch(`${base}/api/router`)).json(), { n: 1 });
    assert.deepEqual(await (await fetch(`${base}/api/router`)).json(), { n: 1 });
    assert.equal((await fetch(`${base}/api/router`, { method: 'POST' })).status, 405);
    const r = await fetch(`${base}/router`, { redirect: 'manual' });
    assert.equal(r.status, 302); assert.equal(r.headers.get('location'), '/router/');
    assert.match(await (await fetch(`${base}/router/`)).text(), /router\.mjs/);
  } finally { server.close(); }
});

test('every surface links the router; the router page links all six', () => {
  for (const p of ['live', 'opencodex', 'tokscale', 'tray', 'usage', 'cpa']) {
    assert.match(readFileSync(new URL(`../${p}/index.html`, import.meta.url), 'utf8'), /<a href="\.\.\/router\/">Router<\/a><\/nav>/, p);
  }
  const html = readFileSync(new URL('../router/index.html', import.meta.url), 'utf8');
  for (const p of ['live', 'opencodex', 'tokscale', 'tray', 'usage', 'cpa']) assert.ok(html.includes(`href="../${p}/"`), p);
  assert.match(html, /aria-current="page">Router</);
  assert.match(html, /data-product="claude-code-router"/);
});
