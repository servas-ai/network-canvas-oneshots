// SERVAS-2071 Claude Code Router sources for /api/router (router/). Two
// read-only facts:
// 1. the CCR configuration (~/.claude-code-router/config.json), whitelisted to
//    routing facts: Router rules ("provider,model"), long-context threshold,
//    timeout, port and per provider its name, model names and transformer
//    names. APIKEY, api_key, api_base_url, URL-shaped names and every other
//    field are dropped;
// 2. a TCP reachability probe of the CCR port. No request goes through the
//    router, so no provider call and no credentials.
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { probePort } from './opencodex.mjs';

export const DEFAULT_CONFIG = join(homedir(), '.claude-code-router', 'config.json');
// CCR listens on 3456 unless config.PORT says otherwise; override per CCR_PORT.
export const DEFAULT_PORT = 3456;
export const RULES = Object.freeze(['default', 'background', 'think', 'longContext', 'webSearch']);

// Model names may carry '/', ':' or '@' (google/gemini-2.5-pro, qwen2.5:7b);
// provider names never do, so a URL can not pass as a provider. URL shapes
// (scheme:/, //host, host:port/) are dropped from model and transformer names,
// as is host:port without a path when the host is localhost, IPv4 or a dotted
// name ending in a letter label (demo.invalid:8080). A bare single-label
// name:digits stays a model tag (llama3:70), it can not be told from a host.
const NAME = /^[\w.:@/-]{1,80}$/, PROVIDER = /^[\w.-]{1,80}$/;
const URL_LIKE = /^[a-z][\w+.-]*:\/|\/\/|:\d+\/|(?:^|[@/])(?:localhost|\d{1,3}(?:\.\d{1,3}){3}|(?:[\w-]+\.)+[a-z]{2,}):\d{1,5}$/i;
const name = v => (typeof v === 'string' && NAME.test(v) && !URL_LIKE.test(v) ? v : null);
const provider = v => (typeof v === 'string' && PROVIDER.test(v) ? v : null);
const int = (v, min, max) => (Number.isInteger(v) && v >= min && v <= max ? v : null);

// "provider,model" -> { provider, model }; anything else (URLs, keys, prose) -> null.
export function parseRule(v) {
  if (typeof v !== 'string') return null;
  const [p, model, ...rest] = v.split(',');
  return !rest.length && provider(p) && name(model) ? { provider: p, model } : null;
}

// transformer.use entries are names or [name, options]; options are dropped.
const transformerNames = t => {
  const use = Array.isArray(t?.use) ? t.use : [];
  return use.map(u => name(Array.isArray(u) ? u[0] : u)).filter(Boolean);
};

export function pickConfig(raw) {
  const router = raw?.Router && typeof raw.Router === 'object' ? raw.Router : {};
  return {
    port: int(raw?.PORT, 1, 65535),
    timeoutMs: int(raw?.API_TIMEOUT_MS, 1, 36e5),
    longContextThreshold: int(router.longContextThreshold, 1, 1e7),
    rules: Object.fromEntries(RULES.map(r => [r, parseRule(router[r])])),
    providers: (Array.isArray(raw?.Providers) ? raw.Providers : []).filter(p => provider(p?.name)).map(p => ({
      name: p.name,
      models: (Array.isArray(p.models) ? p.models : []).map(name).filter(Boolean),
      transformers: transformerNames(p.transformer),
    })),
  };
}

// null: no config file; { valid: false }: unreadable JSON; else whitelisted facts.
export async function readRouterConfig(path = DEFAULT_CONFIG) {
  let text, mtime;
  try { [text, mtime] = await Promise.all([readFile(path, 'utf8'), stat(path).then(s => s.mtime.toISOString())]); } catch { return null; }
  try { return { valid: true, modifiedAt: mtime, ...pickConfig(JSON.parse(text)) }; } catch { return { valid: false, modifiedAt: mtime }; }
}

export async function collectRouter({ configPath = process.env.CCR_CONFIG || DEFAULT_CONFIG, env = process.env, probe = probePort } = {}) {
  const config = await readRouterConfig(configPath);
  const port = Number(env.CCR_PORT) || config?.port || DEFAULT_PORT;
  return { generatedAt: new Date().toISOString(), config, service: await probe(port) };
}
