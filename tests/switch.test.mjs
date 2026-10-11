import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectSwitch, endpoint, parseToml, pickClaude, pickCodex, pickGemini, modelName } from '../app/switch.mjs';
import { createUsageServer } from '../app/server.mjs';
import { endpointText, credentialText, toolStatus, skillMatrix, lastUse, counts } from '../shared/switch.mjs';

const fx = p => fileURLToPath(new URL(`fixtures/switch/${p}`, import.meta.url));
const LEAKS = ['SENTINEL', 'SECRET', 'PROMPT-SHOULD', 'OPTION-SHOULD', 'SKILL-BODY', 'npx', 'DEEPSEEK_API_KEY', 'notify-send',
  'Authorization', 'headers', 'trust_level', '/home/', 'emailAddress', '.invalid'];
const leaks = text => LEAKS.filter(l => text.includes(l));
const byId = (r, id) => r.tools.find(t => t.id === id);

test('full fixture: only whitelisted provider, model, credential mode, names and sizes survive', async () => {
  const r = await collectSwitch({ home: fx('full') });
  assert.deepEqual(r.tools.map(t => [t.id, t.installed]), [['claude', true], ['codex', true], ['gemini', true]]);
  const claude = byId(r, 'claude'), codex = byId(r, 'codex'), gemini = byId(r, 'gemini');
  assert.deepEqual({ ...claude.config, modifiedAt: null }, { valid: true, modifiedAt: null,
    endpoint: { kind: 'local', label: 'CLIProxyAPI', host: 'localhost', port: 8317 }, model: 'claude-sonnet-4.6',
    models: { opus: 'claude-opus-4.6', sonnet: null, haiku: null, fast: null }, credential: 'env' });
  assert.deepEqual(claude.mcp.servers, [{ name: 'github', transport: 'stdio' }, { name: 'docs', transport: 'http' }, { name: 'events', transport: 'sse' }]);
  assert.deepEqual(claude.skills, ['frontend-design', 'review']); // .hidden and folder without SKILL.md skipped
  assert.equal(claude.prompt.bytes, 44);
  assert.deepEqual(claude.backups.map(b => b.name), ['settings.json.2026-10-01.bak', 'settings.json.bak']); // .notes is no backup
  assert.deepEqual({ ...codex.config, modifiedAt: null }, { valid: true, modifiedAt: null, provider: 'deepseek',
    endpoint: { kind: 'known', label: 'DeepSeek', host: 'api.deepseek.com', port: null }, model: 'gpt-5.3-codex', effort: 'high',
    profile: null, profiles: ['fast'], credential: 'env', providers: [
      { id: 'deepseek', endpoint: { kind: 'known', label: 'DeepSeek', host: 'api.deepseek.com', port: null } },
      { id: 'corp', endpoint: { kind: 'custom', label: null, host: null, port: null } },
      { id: 'cliproxy', endpoint: { kind: 'local', label: 'CLIProxyAPI', host: 'localhost', port: 8317 } }] });
  assert.deepEqual(codex.mcp.servers, [{ name: 'filesystem', transport: 'stdio' }, { name: 'remote', transport: 'http' }]);
  assert.deepEqual(codex.backups.map(b => b.name), ['config.toml.servas2001.bak']);
  assert.equal(gemini.config.model, 'gemini-2.5-pro'); assert.equal(gemini.config.credential, 'oauth-personal');
  assert.deepEqual(gemini.mcp.servers, [{ name: 'search', transport: 'http' }]);
  assert.equal(gemini.skills, null); assert.equal(gemini.prompt.bytes, null);
});

test('full fixture: keys, URLs, hosts, MCP commands, prompt and skill bodies never leave', async () => {
  const text = JSON.stringify(await collectSwitch({ home: fx('full') }));
  assert.deepEqual(leaks(text), []);
  assert.ok(!text.includes('project-only'), 'project MCP servers are not read');
  assert.ok(!text.includes('bad name'), 'odd MCP names dropped');
});

test('none: nothing installed is unknown, never defaults; broken: invalid without content', async () => {
  const none = await collectSwitch({ home: fx('none') });
  for (const t of none.tools) {
    assert.equal(t.installed, false); assert.equal(t.config, null); assert.equal(t.skills, null);
    assert.equal(t.mcp.valid, null); assert.deepEqual(t.backups, []);
  }
  const broken = await collectSwitch({ home: fx('broken') });
  for (const t of broken.tools) assert.deepEqual(Object.keys(t.config).sort(), ['modifiedAt', 'valid'], t.id), assert.equal(t.config.valid, false);
  assert.equal(byId(broken, 'codex').mcp.valid, false);
  assert.deepEqual(leaks(JSON.stringify(broken)), []);
});

test('installed tool without config file runs on defaults, flagged as missing', async () => {
  const r = await collectSwitch({ home: fx('full') });
  const t = { ...byId(r, 'gemini'), config: { valid: true, missing: true, modifiedAt: null, ...pickGemini({}) } };
  assert.equal(toolStatus(t).text, 'Standardwerte');
  assert.deepEqual(pickClaude({}).endpoint, { kind: 'known', label: 'Anthropic', host: 'api.anthropic.com', port: null, default: true });
  assert.equal(pickCodex({}).provider, 'openai');
});

test('endpoint: public hosts by name, local by port, everything else without host', () => {
  assert.deepEqual(endpoint('https://openrouter.ai/api/v1'), { kind: 'known', label: 'OpenRouter', host: 'openrouter.ai', port: null });
  assert.deepEqual(endpoint('http://localhost:3456'), { kind: 'local', label: 'Claude Code Router', host: 'localhost', port: 3456 });
  assert.deepEqual(endpoint('http://127.0.0.1:10100/v1'), { kind: 'local', label: 'OpenCodex', host: 'localhost', port: 10100 });
  assert.deepEqual(endpoint('https://[::1]/x'), { kind: 'local', label: 'Lokaler Proxy', host: 'localhost', port: 443 });
  assert.deepEqual(endpoint('http://localhost'), { kind: 'local', label: 'Lokaler Proxy', host: 'localhost', port: 80 });
  for (const custom of ['https://llm.corp.invalid/v1', 'https://api.anthropic.com.evil.invalid/', 'https://api.anthropic.com@evil.invalid/',
    'https://evil.invalid/?h=api.anthropic.com', 'http://10.0.0.5:8317', 'https://user:pw@openrouter.ai.evil.invalid'])
    assert.deepEqual(endpoint(custom), { kind: 'custom', label: null, host: null, port: null }, custom);
  for (const bad of ['file:///etc/passwd', 'javascript:alert(1)', 'not a url', 'ftp://openrouter.ai/', 42])
    assert.equal(endpoint(bad).kind, 'invalid', String(bad));
  for (const unset of [undefined, null, '']) assert.equal(endpoint(unset), null);
});

test('modelName reuses the router whitelist: URL and host:port shapes dropped, ids kept', () => {
  for (const ok of ['claude-sonnet-4.6', 'qwen2.5:7b', 'google/gemini-2.5-pro', 'anthropic/claude-sonnet-4@20250514']) assert.equal(modelName(ok), ok);
  for (const bad of ['https://demo.invalid/x', 'localhost:11434', 'demo.invalid:8080', 'a,b', '', undefined, null, 7, { a: 1 }]) assert.equal(modelName(bad), null, String(bad));
});

test('parseToml: tables, quoted keys, comments; skips arrays and multi-line values', () => {
  const t = parseToml(['# c', 'a = 1_000 # n', 'b = \'lit\'', 'arr = [', '  "x",', ']', 's = """', 'body', '"""', 'after = true',
    '[x."/p q".y]', 'k = "v\\"q"', 'inline = { a = 1 }', '[[list]]', 'z = 1', '[x."/p q".y]', 'k2 = -2.5'].join('\n'));
  assert.deepEqual(t, { a: 1000, b: 'lit', after: true, x: { '/p q': { y: { k: 'v"q', k2: -2.5 } } } });
  for (const bad of ['a b = 1', 'a.b c = 1', '[__proto__]\nx = 1', 'constructor = 1', 'just text', '[a b]\nk = 1'])
    assert.throws(() => parseToml(bad), SyntaxError, bad);
  assert.equal({}.x, undefined, 'no prototype pollution');
});

test('parseToml: a long garbage line fails fast (no regex backtracking)', () => {
  for (const line of ['x '.repeat(3000), `${'a-'.repeat(3000)}b`, `"${'q'.repeat(6000)}`]) {
    const t0 = performance.now();
    assert.throws(() => parseToml(line), SyntaxError);
    assert.ok(performance.now() - t0 < 200, `${line.slice(0, 8)}… took ${performance.now() - t0} ms`);
  }
});

test('pickCodex: profile wins, built-in and unknown providers, effort enum', () => {
  const c = pickCodex({ model: 'gpt-5.3-codex', model_provider: 'openai', model_reasoning_effort: 'turbo', profile: 'local',
    profiles: { local: { model_provider: 'oss', model: 'qwen2.5:7b', model_reasoning_effort: 'low' } } });
  assert.deepEqual([c.provider, c.endpoint.label, c.endpoint.port, c.model, c.effort, c.profile], ['oss', 'Ollama (oss)', 11434, 'qwen2.5:7b', 'low', 'local']);
  assert.equal(pickCodex({ model_reasoning_effort: 'turbo' }).effort, null);
  assert.deepEqual(pickCodex({ model_provider: 'ghost' }).endpoint, { kind: 'custom', label: null, host: null, port: null });
  assert.equal(pickCodex({ model_provider: 'x', model_providers: { x: {} } }).credential, 'unknown');
  assert.equal(pickCodex({ model_provider: 'bad id!' }).provider, 'openai');
});

test('pickClaude and pickGemini: credential mode only, legacy fields, unknown auth', () => {
  assert.equal(pickClaude({ apiKeyHelper: 'x' }).credential, 'helper');
  assert.equal(pickClaude({ env: { ANTHROPIC_API_KEY: '' } }).credential, 'login');
  assert.equal(pickClaude({ env: { ANTHROPIC_MODEL: 'kimi-k2' } }).model, 'kimi-k2');
  assert.deepEqual([pickGemini({ model: 'gemini-2.5-flash', selectedAuthType: 'gemini-api-key' }).model, pickGemini({ selectedAuthType: 'gemini-api-key' }).credential],
    ['gemini-2.5-flash', 'gemini-api-key']);
  assert.equal(pickGemini({ security: { auth: { selectedType: 'SECRET' } } }).credential, 'unknown');
  assert.equal(pickGemini({ security: { auth: { selectedType: 'vertex-ai' } } }).endpoint.label, 'Vertex AI');
});

test('collector reads only: fixture files unchanged, no write API in app/switch.mjs', async () => {
  const snap = dir => readdirSync(dir, { recursive: true }).sort().map(f => { const s = statSync(join(dir, f)); return `${f}:${s.size}:${s.mtimeMs}`; });
  const before = snap(fx('full'));
  await collectSwitch({ home: fx('full') });
  assert.deepEqual(snap(fx('full')), before);
  const src = readFileSync(new URL('../app/switch.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /writeFile|appendFile|rename|unlink|rmdir|mkdir|copyFile|\brm\(|child_process|fetch\(/);
});

test('api/switch over the real server: whitelisted body, GET only, page served', async () => {
  const server = createUsageServer({ switches: () => collectSwitch({ home: fx('full') }) });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const res = await fetch(`${base}/api/switch`);
    assert.equal(res.status, 200);
    const text = await res.text();
    assert.deepEqual(leaks(text), []);
    assert.equal(JSON.parse(text).tools.length, 3);
    assert.equal((await fetch(`${base}/api/switch`, { method: 'POST' })).status, 405);
    const r = await fetch(`${base}/switch`, { redirect: 'manual' });
    assert.equal(r.status, 302); assert.equal(r.headers.get('location'), '/switch/');
    assert.match(await (await fetch(`${base}/switch/`)).text(), /switch\.mjs/);
  } finally { server.close(); }
});

test('view logic: custom endpoints never show a host, unknown stays unknown', async () => {
  assert.deepEqual(endpointText({ kind: 'custom', label: null, host: null, port: null }), { title: 'Eigener Endpunkt', detail: 'Adresse wird nicht angezeigt', link: null });
  assert.deepEqual(endpointText({ kind: 'local', label: 'CLIProxyAPI', host: 'localhost', port: 8317 }), { title: 'CLIProxyAPI', detail: 'localhost:8317', link: '../cpa/' });
  assert.equal(endpointText({ kind: 'local', label: 'Lokaler Proxy', host: 'localhost', port: 9999 }).link, null);
  assert.equal(endpointText(null).title, 'Unbekannt');
  assert.equal(credentialText('unknown'), null); assert.equal(credentialText('__proto__'), null);
  assert.deepEqual([toolStatus({ installed: false }).text, toolStatus({ installed: true, config: { valid: false } }).state], ['Nicht installiert', 'error']);
  const r = await collectSwitch({ home: fx('full') });
  const m = skillMatrix(r.tools);
  assert.deepEqual(m.map(x => [x.name, x.claude, x.codex, x.gemini, x.shared]),
    [['frontend-design', true, false, null, false], ['release', false, true, null, false], ['review', true, false, null, false]]);
  assert.deepEqual(counts(r.tools), { mcp: 6, skills: 3, prompts: 2, backups: 3 });
  const usage = { sources: [{ id: 'claude', observedAt: '2026-10-09T10:00:00Z' }, { id: 'codex', observedAt: null }] };
  assert.deepEqual([lastUse(usage, 'claude'), lastUse(usage, 'codex'), lastUse(usage, 'gemini')], ['2026-10-09T10:00:00Z', null, undefined]);
});

test('every surface links the switch; the switch page links all seven', () => {
  const pages = ['live', 'opencodex', 'tokscale', 'tray', 'usage', 'cpa', 'router'];
  for (const p of pages) assert.match(readFileSync(new URL(`../${p}/index.html`, import.meta.url), 'utf8'), /<a href="\.\.\/switch\/">Switch<\/a><\/nav>/, p);
  const html = readFileSync(new URL('../switch/index.html', import.meta.url), 'utf8');
  for (const p of pages) assert.ok(html.includes(`href="../${p}/"`), p);
  assert.match(html, /aria-current="page">Switch</);
  assert.match(html, /data-product="cc-switch"/);
  assert.match(html, /aria-labelledby="tab-providers"/);
});
