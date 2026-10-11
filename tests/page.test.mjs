import test from 'node:test';
import assert from 'node:assert/strict';
import { readTheme, tabTarget, shortcut, createLoader, getJson, THEME_KEY } from '../shared/page.mjs';

const store = v => ({ getItem: k => (k === THEME_KEY ? v : null) });

test('theme: stored light/dark kept, anything else is dark', () => {
  assert.equal(readTheme(store('light')), 'light');
  assert.equal(readTheme(store('dark')), 'dark');
  for (const bad of [null, '', 'blue', '<script>']) assert.equal(readTheme(store(bad)), 'dark');
  assert.equal(readTheme(null), 'dark');
  assert.equal(readTheme({ getItem() { throw new Error('SecurityError'); } }), 'dark');
});

test('tabs: arrows wrap, Home/End jump, other keys ignored', () => {
  assert.equal(tabTarget('ArrowRight', 2, 3), 0);
  assert.equal(tabTarget('ArrowLeft', 0, 3), 2);
  assert.equal(tabTarget('Home', 2, 3), 0);
  assert.equal(tabTarget('End', 0, 3), 2);
  assert.equal(tabTarget('Enter', 1, 3), null);
  assert.equal(tabTarget('ArrowRight', 0, 0), null);
});

test('shortcuts: none while typing or with modifiers, no prototype keys', () => {
  const r = () => 'r', actions = { r };
  const target = { closest: () => null };
  const typing = { closest: () => ({}) };
  assert.equal(shortcut({ key: 'r', target }, actions), r);
  assert.equal(shortcut({ key: 'r', target: typing }, actions), null);
  for (const mod of ['metaKey', 'ctrlKey', 'altKey']) assert.equal(shortcut({ key: 'r', [mod]: true, target }, actions), null);
  assert.equal(shortcut({ key: 'x', target }, actions), null);
  assert.equal(shortcut({ key: 'toString', target }, actions), null);
});

function deferred() { let resolve, reject; const p = new Promise((a, b) => { resolve = a; reject = b; }); return { p, resolve, reject }; }

test('loader: one fetch at a time, busy toggles around it', async () => {
  const d = deferred(), busy = [], got = [];
  let calls = 0;
  const { load } = createLoader({ fetchData: () => { calls++; return d.p; }, onData: v => got.push(v), onError: assert.fail, onBusy: b => busy.push(b) });
  const a = load(), b = load();
  await null; await null;
  assert.equal(a, b); assert.equal(load(), a); assert.equal(calls, 1); assert.deepEqual(busy, [true]);
  d.resolve(1); await a;
  assert.deepEqual(got, [1]); assert.deepEqual(busy, [true, false]);
  await load(); assert.equal(calls, 2);
});

test('loader: reload during a fetch runs a second fetch, not dropped', async () => {
  const first = deferred(), seen = [];
  let n = 0;
  const { load, reload } = createLoader({ fetchData: () => (++n === 1 ? first.p : 'second'), onData: v => seen.push(v), onError: assert.fail });
  load();
  const r = reload();
  first.resolve('first'); await r;
  assert.deepEqual(seen, ['first', 'second']);
});

test('loader: fetch, sync throw and render errors all reach onError and unlock', async () => {
  for (const [fetchData, onData] of [
    [() => Promise.reject(new Error('net')), () => {}],
    [() => { throw new Error('sync'); }, () => {}],
    [() => 1, () => { throw new Error('render'); }],
  ]) {
    const errs = [], busy = [];
    const { load } = createLoader({ fetchData, onData, onError: e => errs.push(e.message), onBusy: b => busy.push(b) });
    await load();
    assert.equal(errs.length, 1); assert.deepEqual(busy, [true, false]);
    await load(); assert.equal(errs.length, 2, 'not stuck after error');
  }
});

test('getJson: no-store, HTTP errors name the path', async () => {
  let opts;
  const ok = await getJson('/api/x', async (_p, o) => { opts = o; return { ok: true, json: async () => ({ a: 1 }) }; });
  assert.deepEqual(ok, { a: 1 }); assert.equal(opts.cache, 'no-store');
  await assert.rejects(getJson('/api/usage?days=1', async () => ({ ok: false, status: 503 })), /\/api\/usage\?days=1: HTTP 503/);
});
