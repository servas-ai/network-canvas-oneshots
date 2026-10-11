// SERVAS-2071 CC Switch sources for /api/switch (switch/). Read only: which
// provider, model and credential mode Claude Code, Codex and Gemini CLI are
// configured for, plus MCP server names, skill names, global prompt files and
// config backups. Whitelisted facts only:
// - endpoints become a provider label: public hosts from HOSTS by name, local
//   proxies by port, everything else "custom" without the host;
// - credentials become a mode (env/helper/...), never a value;
// - MCP servers keep name and transport, never command, args, env, headers or URL;
// - prompt files and backups keep size and mtime, never content.
// Nothing is written: switching providers is not offered (no write path).
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { parseRule, DEFAULT_PORT as CCR_PORT } from './router.mjs';
import { DEFAULT_PORT as OPENCODEX_PORT } from './opencodex.mjs';

// Same model-name whitelist as the router (PR12 router PASS @e1f23b1): URL and
// host:port shapes are dropped, namespace/tag/@ ids stay.
export const modelName = v => (typeof v === 'string' ? parseRule(`m,${v}`)?.model ?? null : null);
const ID = /^[\w.-]{1,64}$/;
const id = v => (typeof v === 'string' && ID.test(v) ? v : null);
const set = v => typeof v === 'string' && v.trim() !== '';
const plain = v => v !== null && typeof v === 'object' && !Array.isArray(v);

// Public provider API hosts that may be named. Any other host stays unnamed.
export const HOSTS = Object.freeze({
  'api.anthropic.com': 'Anthropic', 'api.openai.com': 'OpenAI', 'chatgpt.com': 'OpenAI',
  'openrouter.ai': 'OpenRouter', 'api.deepseek.com': 'DeepSeek', 'api.moonshot.ai': 'Moonshot', 'api.moonshot.cn': 'Moonshot',
  'api.z.ai': 'Zhipu GLM', 'open.bigmodel.cn': 'Zhipu GLM', 'dashscope.aliyuncs.com': 'Qwen DashScope',
  'dashscope-intl.aliyuncs.com': 'Qwen DashScope', 'api.minimax.io': 'MiniMax', 'api.minimaxi.com': 'MiniMax',
  'api.x.ai': 'xAI', 'generativelanguage.googleapis.com': 'Google AI Studio', 'api.groq.com': 'Groq', 'api.mistral.ai': 'Mistral',
});
// Local gateways this suite already knows (cpa/, router/, opencodex/).
export const LOCAL_PORTS = Object.freeze({ 8317: 'CLIProxyAPI', [CCR_PORT]: 'Claude Code Router', [OPENCODEX_PORT]: 'OpenCodex' });

// URL -> { kind: known|local|custom|invalid, label, host, port }; unset -> null.
export function endpoint(url) {
  if (url === undefined || url === null || url === '') return null;
  let u;
  try { u = new URL(String(url)); } catch { return { kind: 'invalid', label: null, host: null, port: null }; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return { kind: 'invalid', label: null, host: null, port: null };
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host === '::1' || /^127(?:\.\d{1,3}){3}$/.test(host)) {
    const port = Number(u.port) || (u.protocol === 'https:' ? 443 : 80);
    return { kind: 'local', label: LOCAL_PORTS[port] ?? 'Lokaler Proxy', host: 'localhost', port };
  }
  if (Object.hasOwn(HOSTS, host)) return { kind: 'known', label: HOSTS[host], host, port: null };
  return { kind: 'custom', label: null, host: null, port: null };
}

// Minimal TOML reader for Codex config.toml: tables, dotted/quoted keys,
// strings, numbers, booleans. Arrays, inline tables and multi-line values are
// skipped (not needed); anything unparseable throws -> config invalid.
const UNSAFE = new Set(['__proto__', 'constructor', 'prototype']);
function keyPath(src) {
  const out = [];
  let used = 0;
  for (const m of src.matchAll(/\s*(?:"((?:[^"\\]|\\.)*)"|'([^']*)'|([\w-]+))\s*(?:\.|$)/gy)) { out.push(m[1] ?? m[2] ?? m[3]); used += m[0].length; }
  if (!out.length || used !== src.length || src.length > 512 || out.some(k => UNSAFE.has(k))) throw new SyntaxError('bad key');
  return out;
}
function scalar(v) {
  let m;
  if ((m = /^"((?:[^"\\]|\\.)*)"\s*(?:#.*)?$/.exec(v))) return JSON.parse(`"${m[1]}"`);
  if ((m = /^'([^']*)'\s*(?:#.*)?$/.exec(v))) return m[1];
  if ((m = /^(true|false)\s*(?:#.*)?$/.exec(v))) return m[1] === 'true';
  if ((m = /^([+-]?\d[\d_]*(?:\.\d+)?)\s*(?:#.*)?$/.exec(v))) return Number(m[1].replace(/_/g, ''));
  return undefined;
}
const depth = s => [...s].reduce((d, c) => d + (c === '[' || c === '{' ? 1 : c === ']' || c === '}' ? -1 : 0), 0);
export function parseToml(text) {
  const root = {};
  let table = root, skip = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (skip) { if (skip(line)) skip = null; continue; }
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('[[')) { table = {}; continue; } // array of tables: ignored
    const head = /^\[([^\]]+)\]\s*(?:#.*)?$/.exec(line);
    if (head) {
      table = root;
      for (const k of keyPath(head[1])) { if (!plain(table[k])) table[k] = {}; table = table[k]; }
      continue;
    }
    // Linear key match (no nested quantifiers: a garbage line must not backtrack); keyPath validates.
    const kv = /^([^=]{1,512}?)\s*=\s*(.*)$/.exec(line);
    if (!kv) throw new SyntaxError('bad line');
    const path = keyPath(kv[1]), value = kv[2];
    for (const q of ['"""', "'''"]) if (value.startsWith(q) && value.indexOf(q, 3) === -1) skip = l => l.includes(q);
    if (!skip && /^[[{]/.test(value)) { let d = depth(value); if (d > 0) skip = l => (d += depth(l)) <= 0; }
    const v = skip || /^[[{]/.test(value) || value.startsWith('"""') || value.startsWith("'''") ? undefined : scalar(value);
    if (v === undefined) continue;
    let t = table;
    for (const k of path.slice(0, -1)) { if (!plain(t[k])) t[k] = {}; t = t[k]; }
    t[path.at(-1)] = v;
  }
  return root;
}

const EFFORT = new Set(['minimal', 'low', 'medium', 'high', 'xhigh']);
const GEMINI_AUTH = Object.freeze({ 'oauth-personal': 'Google-Anmeldung', 'gemini-api-key': 'Gemini-API-Schlüssel',
  'vertex-ai': 'Vertex AI', 'cloud-shell': 'Cloud Shell', 'compute-default-credentials': 'Compute-Standardkonto' });
// Codex built-in providers (no [model_providers] table needed).
const CODEX_BUILTIN = Object.freeze({ openai: { kind: 'known', label: 'OpenAI', host: 'api.openai.com', port: null },
  oss: { kind: 'local', label: 'Ollama (oss)', host: 'localhost', port: 11434 }, ollama: { kind: 'local', label: 'Ollama', host: 'localhost', port: 11434 } });

const mcpList = servers => (plain(servers) ? Object.entries(servers) : [])
  .filter(([n, s]) => id(n) && plain(s))
  .map(([n, s]) => ({ name: n, transport: set(s.url) || set(s.httpUrl) || /^(http|sse|streamable-http)$/.test(s.type) ? (s.type === 'sse' ? 'sse' : 'http') : 'stdio' }));

export function pickClaude(settings) {
  const env = plain(settings?.env) ? settings.env : {};
  return {
    endpoint: endpoint(env.ANTHROPIC_BASE_URL) ?? { kind: 'known', label: 'Anthropic', host: 'api.anthropic.com', port: null, default: true },
    model: modelName(settings?.model) ?? modelName(env.ANTHROPIC_MODEL),
    models: Object.fromEntries([['opus', 'ANTHROPIC_DEFAULT_OPUS_MODEL'], ['sonnet', 'ANTHROPIC_DEFAULT_SONNET_MODEL'],
      ['haiku', 'ANTHROPIC_DEFAULT_HAIKU_MODEL'], ['fast', 'ANTHROPIC_SMALL_FAST_MODEL']].map(([k, e]) => [k, modelName(env[e])])),
    // Values are never read beyond "set or not".
    credential: set(env.ANTHROPIC_AUTH_TOKEN) || set(env.ANTHROPIC_API_KEY) ? 'env' : set(settings?.apiKeyHelper) ? 'helper' : 'login',
  };
}

export function pickCodex(conf) {
  const profileName = id(conf?.profile);
  const profile = profileName && plain(conf?.profiles?.[profileName]) ? conf.profiles[profileName] : {};
  const providers = plain(conf?.model_providers) ? conf.model_providers : {};
  const active = id(profile.model_provider) ?? id(conf?.model_provider) ?? 'openai';
  const p = plain(providers[active]) ? providers[active] : null;
  return {
    provider: active,
    endpoint: p ? endpoint(p.base_url) ?? { kind: 'custom', label: null, host: null, port: null } : CODEX_BUILTIN[active] ?? { kind: 'custom', label: null, host: null, port: null },
    model: modelName(profile.model) ?? modelName(conf?.model),
    effort: [profile.model_reasoning_effort, conf?.model_reasoning_effort].find(e => EFFORT.has(e)) ?? null,
    profile: profileName,
    profiles: plain(conf?.profiles) ? Object.keys(conf.profiles).map(id).filter(Boolean) : [],
    providers: Object.entries(providers).filter(([n, v]) => id(n) && plain(v)).map(([n, v]) => ({ id: n, endpoint: endpoint(v.base_url) })),
    // auth.json is never opened; ChatGPT login vs. API key is not knowable here.
    credential: p && set(p.env_key) ? 'env' : 'unknown',
  };
}

export function pickGemini(settings) {
  const model = plain(settings?.model) ? settings.model.name : settings?.model;
  const auth = settings?.security?.auth?.selectedType ?? settings?.selectedAuthType;
  return {
    endpoint: auth === 'vertex-ai' ? { kind: 'known', label: 'Vertex AI', host: null, port: null }
      : { kind: 'known', label: 'Google AI Studio', host: 'generativelanguage.googleapis.com', port: null, default: true },
    model: modelName(model),
    credential: Object.hasOwn(GEMINI_AUTH, auth) ? auth : 'unknown',
  };
}

async function file(path) {
  try { const s = await stat(path); return s.isFile() ? { bytes: s.size, modifiedAt: s.mtime.toISOString() } : null; } catch { return null; }
}

// null: no file; { valid: false, modifiedAt }: unreadable; else { valid, modifiedAt, data }.
async function readConfig(path, parse) {
  const meta = await file(path);
  if (!meta) return null;
  try { return { valid: true, modifiedAt: meta.modifiedAt, data: parse(await readFile(path, 'utf8')) }; } catch { return { valid: false, modifiedAt: meta.modifiedAt }; }
}

// Skill folder names (with SKILL.md); dot folders and odd names are skipped.
async function skills(dir) {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return null; }
  const names = [];
  for (const e of entries) if (id(e.name) && !e.name.startsWith('.') && (e.isDirectory() || e.isSymbolicLink()) && await file(join(dir, e.name, 'SKILL.md'))) names.push(e.name);
  return names.sort();
}

// config.toml.bak, settings.json.servas2001.bak, ...: name, size, mtime.
async function backups(dir, base) {
  let names;
  try { names = await readdir(dir); } catch { return []; }
  const re = new RegExp(`^${base.replace(/\./g, '\\.')}(?:\\.[\\w-]+)*\\.(?:bak|backup|old)(?:\\.[\\w-]+)*$`);
  const out = [];
  for (const n of names.filter(n => re.test(n) && n.length <= 96).sort()) { const f = await file(join(dir, n)); if (f) out.push({ name: n, ...f }); }
  return out;
}

const TOOLS = Object.freeze([
  { id: 'claude', label: 'Claude Code', dir: '.claude', config: 'settings.json', prompt: 'CLAUDE.md' },
  { id: 'codex', label: 'Codex', dir: '.codex', config: 'config.toml', prompt: 'AGENTS.md' },
  { id: 'gemini', label: 'Gemini CLI', dir: '.gemini', config: 'settings.json', prompt: 'GEMINI.md' },
]);

export async function collectSwitch({ home = process.env.CC_SWITCH_HOME || homedir() } = {}) {
  const tools = await Promise.all(TOOLS.map(async t => {
    const dir = join(home, t.dir);
    const installed = Boolean(await stat(dir).then(s => s.isDirectory(), () => false));
    const raw = await readConfig(join(dir, t.config), t.id === 'codex' ? parseToml : JSON.parse);
    const pick = { claude: pickClaude, codex: pickCodex, gemini: pickGemini }[t.id];
    // Claude Code keeps user MCP servers in ~/.claude.json, the others in their config.
    const mcpRaw = t.id === 'claude' ? await readConfig(join(home, '.claude.json'), JSON.parse) : raw;
    const servers = mcpRaw?.valid ? mcpRaw.data?.[t.id === 'codex' ? 'mcp_servers' : 'mcpServers'] : undefined;
    return {
      id: t.id, label: t.label, installed,
      configFile: `~/${t.dir}/${t.config}`,
      // Without a config file the tool runs on its defaults: pick({}).
      config: raw === null ? (installed ? { valid: true, missing: true, modifiedAt: null, ...pick({}) } : null)
        : raw.valid ? { valid: true, modifiedAt: raw.modifiedAt, ...pick(plain(raw.data) ? raw.data : {}) } : { valid: false, modifiedAt: raw.modifiedAt },
      mcp: { file: t.id === 'claude' ? '~/.claude.json' : `~/${t.dir}/${t.config}`, valid: mcpRaw ? mcpRaw.valid : null, servers: mcpRaw?.valid ? mcpList(servers) : [] },
      skills: await skills(join(dir, 'skills')),
      prompt: { file: `~/${t.dir}/${t.prompt}`, ...((await file(join(dir, t.prompt))) ?? { bytes: null, modifiedAt: null }) },
      backups: await backups(dir, t.config),
    };
  }));
  return { generatedAt: new Date().toISOString(), tools };
}
