#!/usr/bin/env node
// SERVAS-2071 local server: static suite + GET /api/usage?days=N.
// Binds 127.0.0.1 only; no write endpoints, no provider calls.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectUsage } from './collect.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TYPES = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };
const CACHE_MS = 60000;
const APPS = ['/live', '/tokscale'];

export function createUsageServer({ collect = collectUsage, root = ROOT } = {}) {
  const cache = new Map();
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
