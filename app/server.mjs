#!/usr/bin/env node
// SERVAS-2071 local server: static suite + GET /api/usage?days=N, /api/opencodex, /api/gateways, /api/router and /api/switch.
// Binds 127.0.0.1 only; no write endpoints, no provider calls.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectUsage } from './collect.mjs';
import { collectOpencodex } from './opencodex.mjs';
import { collectGateways } from './gateways.mjs';
import { collectRouter } from './router.mjs';
import { collectSwitch } from './switch.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TYPES = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };
const CACHE_MS = 60000;
const APPS = ['/live', '/tokscale', '/tray', '/usage', '/opencodex', '/cpa', '/router', '/switch'];
const OPENCODEX_CACHE_MS = 15000;

export function createUsageServer({ collect = collectUsage, opencodex = collectOpencodex, gateways = collectGateways, router = collectRouter, switches = collectSwitch, root = ROOT } = {}) {
  const cache = new Map();
  let gateway = null; // { at, data }: catalogue read + one TCP probe, cached briefly
  let nodes = null; // { at, data }: gateway TCP probes, cached briefly
  let ccr = null; // { at, data }: whitelisted CCR config + one TCP probe, cached briefly
  let tools = null; // { at, data }: whitelisted Claude Code / Codex / Gemini CLI configs, cached briefly
  let inflight = null; // one collection at a time keeps disk/CPU load bounded
  async function usage(days) {
    const hit = cache.get(days);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;
    while (inflight) await inflight.catch(() => {});
    inflight = collect({ days });
    try {
      const data = await inflight;
      cache.set(days, { at: Date.now(), data });
      return data;
    } finally { inflight = null; }
  }
  return createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    try {
      if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return; }
      if (url.pathname === '/api/usage') {
        const days = Number(url.searchParams.get('days') ?? 30);
        const body = JSON.stringify(await usage(Number.isFinite(days) ? Math.max(1, Math.min(365, Math.trunc(days))) : 30));
        res.writeHead(200, { 'content-type': TYPES['.json'], 'cache-control': 'no-store' }).end(body);
        return;
      }
      if (url.pathname === '/api/opencodex') {
        if (!gateway || Date.now() - gateway.at >= OPENCODEX_CACHE_MS) gateway = { at: Date.now(), data: await opencodex() };
        res.writeHead(200, { 'content-type': TYPES['.json'], 'cache-control': 'no-store' }).end(JSON.stringify(gateway.data));
        return;
      }
      if (url.pathname === '/api/gateways') {
        if (!nodes || Date.now() - nodes.at >= OPENCODEX_CACHE_MS) nodes = { at: Date.now(), data: await gateways() };
        res.writeHead(200, { 'content-type': TYPES['.json'], 'cache-control': 'no-store' }).end(JSON.stringify(nodes.data));
        return;
      }
      if (url.pathname === '/api/router') {
        if (!ccr || Date.now() - ccr.at >= OPENCODEX_CACHE_MS) ccr = { at: Date.now(), data: await router() };
        res.writeHead(200, { 'content-type': TYPES['.json'], 'cache-control': 'no-store' }).end(JSON.stringify(ccr.data));
        return;
      }
      if (url.pathname === '/api/switch') {
        if (!tools || Date.now() - tools.at >= OPENCODEX_CACHE_MS) tools = { at: Date.now(), data: await switches() };
        res.writeHead(200, { 'content-type': TYPES['.json'], 'cache-control': 'no-store' }).end(JSON.stringify(tools.data));
        return;
      }
      // Redirect so relative module/style URLs in the app pages resolve.
      if (url.pathname === '/') { res.writeHead(302, { location: '/live/' }).end(); return; }
      if (APPS.includes(url.pathname)) { res.writeHead(302, { location: `${url.pathname}/` }).end(); return; }
      const path = url.pathname.endsWith('/') ? `${url.pathname}index.html` : url.pathname;
      const rel = normalize(decodeURIComponent(path)).replace(/^([/\\])+/, '');
      const file = join(root, rel);
      if (!file.startsWith(root.endsWith(sep) ? root : root + sep) || rel.split(sep).some(p => p.startsWith('.'))) { res.writeHead(404).end(); return; }
      const data = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(data);
    } catch (err) {
      const code = err?.code === 'ENOENT' || err?.code === 'EISDIR' ? 404 : 500;
      res.writeHead(code, { 'content-type': 'text/plain' }).end(code === 404 ? 'not found' : 'error');
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 8874);
  createUsageServer().listen(port, '127.0.0.1', () => console.log(`http://127.0.0.1:${port}/`));
}
