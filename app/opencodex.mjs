// SERVAS-2071 OpenCodex sources for /api/opencodex. Two read-only facts:
// 1. the Codex model catalogue (~/.codex/models_cache.json), whitelisted to
//    public catalogue fields; identity hash and model instructions are dropped,
//    auth.json/config.toml are never opened;
// 2. a TCP reachability probe of the local OpenCodex gateway port. No request
//    is sent through the gateway, so no provider call and no credentials.
import { readFile } from 'node:fs/promises';
import { createConnection } from 'node:net';
import { join } from 'node:path';
import { homedir } from 'node:os';

export const DEFAULT_CATALOG = join(homedir(), '.codex', 'models_cache.json');
// Port of the opencodex.html mockup ("Listening on port 10100"); override per OPENCODEX_PORT.
export const DEFAULT_PORT = 10100;

const str = v => (typeof v === 'string' && v.length <= 200 ? v : null);
const iso = v => (typeof v === 'string' && Number.isFinite(Date.parse(v)) ? new Date(Date.parse(v)).toISOString() : null);

export async function readCatalog(path = DEFAULT_CATALOG) {
  let raw;
  try { raw = JSON.parse(await readFile(path, 'utf8')); } catch { return null; }
  const models = Array.isArray(raw?.models) ? raw.models : [];
  return {
    fetchedAt: iso(raw?.fetched_at),
    clientVersion: str(raw?.client_version),
    models: models.filter(m => str(m?.slug)).map(m => ({
      slug: m.slug,
      name: str(m.display_name) ?? m.slug,
      visibility: str(m.visibility),
      priority: Number.isFinite(m.priority) ? m.priority : null,
      defaultEffort: str(m.default_reasoning_level),
      efforts: (Array.isArray(m.supported_reasoning_levels) ? m.supported_reasoning_levels : []).map(l => str(l?.effort)).filter(Boolean),
      api: m.supported_in_api === true,
    })).sort((a, b) => (a.priority ?? 1e9) - (b.priority ?? 1e9)),
  };
}

export function probePort(port, { host = '127.0.0.1', timeoutMs = 400, now = Date.now } = {}) {
  return new Promise(resolve => {
    const started = now();
    const sock = createConnection({ host, port });
    const done = reachable => { sock.destroy(); resolve({ host, port, reachable, latencyMs: reachable ? now() - started : null, checkedAt: new Date(now()).toISOString() }); };
    sock.setTimeout(timeoutMs, () => done(false));
    sock.once('connect', () => done(true));
    sock.once('error', () => done(false));
  });
}

export async function collectOpencodex({ catalogPath = DEFAULT_CATALOG, port = Number(process.env.OPENCODEX_PORT) || DEFAULT_PORT } = {}) {
  const [catalog, gateway] = await Promise.all([readCatalog(catalogPath), probePort(port)]);
  return { generatedAt: new Date().toISOString(), catalog, gateway };
}
