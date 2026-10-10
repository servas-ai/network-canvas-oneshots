import test from 'node:test';
import assert from 'node:assert/strict';
import { createUsageServer } from '../app/server.mjs';

async function withServer(opts, fn) {
  const server = createUsageServer(opts);
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  try { await fn(`http://127.0.0.1:${server.address().port}`); } finally { server.close(); }
}

test('api clamps days, caches and is read-only', async () => {
  const calls = [];
  await withServer({ collect: async ({ days }) => (calls.push(days), { days }) }, async base => {
    assert.deepEqual(await (await fetch(`${base}/api/usage?days=9999`)).json(), { days: 365 });
    await fetch(`${base}/api/usage?days=9999`);
    assert.deepEqual(calls, [365]);
    assert.equal((await fetch(`${base}/api/usage?days=abc`)).status, 200);
    assert.equal((await fetch(`${base}/api/usage`, { method: 'POST' })).status, 405);
  });
});

test('static: root redirects, live page served, traversal and dotfiles blocked', async () => {
  await withServer({ collect: async () => ({}) }, async base => {
    const r = await fetch(`${base}/`, { redirect: 'manual' });
    assert.equal(r.status, 302); assert.equal(r.headers.get('location'), '/live/');
    assert.match(await (await fetch(`${base}/live/`)).text(), /dashboard\.mjs/);
    assert.equal((await fetch(`${base}/live/dashboard.mjs`)).headers.get('content-type'), 'text/javascript; charset=utf-8');
    for (const p of ['/..%2f..%2f.codex%2fauth.json', '/.git/config', '/%2e%2e/%2e%2e/etc/passwd', '/nope.html']) {
      assert.equal((await fetch(`${base}${p}`)).status, 404, p);
    }
  });
});

test('collector failure returns 500 without details', async () => {
  await withServer({ collect: async () => { throw new Error('/home/x secret'); } }, async base => {
    const r = await fetch(`${base}/api/usage`);
    assert.equal(r.status, 500); assert.equal(await r.text(), 'error');
  });
});
