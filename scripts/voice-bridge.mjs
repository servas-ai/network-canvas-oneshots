#!/usr/bin/env node
/**
 * Voice-Brücke für die One-Shot-Review-Übersicht (OpenSpec oneshots-review-voice-notes-20261006).
 *
 * Die Übersicht läuft auf GitHub Pages. Der Grok-Voice-Harness (127.0.0.1:9381) lehnt fremde Herkunft
 * bewusst ab, ein lokaler STT-Dienst hat meist kein CORS. Diese Brücke lauscht nur auf 127.0.0.1,
 * nimmt Anfragen nur von erlaubten Origins mit dem Token dieses Starts an und leitet serverseitig weiter.
 * Die Schutzregel des Harness bleibt unverändert.
 *
 *   node scripts/voice-bridge.mjs --open          # startet und öffnet die Übersicht schon gekoppelt
 *   node scripts/voice-bridge.mjs [--port 9395]   # nur starten, Kopplungscode steht im Terminal
 *
 * Umgebung (alles optional):
 *   VOICE_BRIDGE_PORT  Standard 9395
 *   STT_URL            Standard http://127.0.0.1:8178/inference (whisper.cpp). OpenAI-kompatibel: …/v1/audio/transcriptions
 *   STT_MODEL          Modellname für OpenAI-kompatible Dienste (Standard whisper-1)
 *   STT_LANGUAGE       Standard de
 *   WHISPER_MODEL      ggml-Modell für den automatischen Start (Standard ~/.whisper-models/ggml-base.bin)
 *   WHISPER_SERVER     Programm für den automatischen Start (Standard whisper-server im PATH)
 *   GROK_VOICE_URL     Standard http://127.0.0.1:9381
 *   REVIEW_URL         Standard https://servas-ai.github.io/network-canvas-oneshots/
 *   ALLOW_ORIGINS      weitere erlaubte Origins, durch Komma getrennt
 */
import http from 'node:http';
import { spawn, execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { randomBytes, timingSafeEqual } from 'node:crypto';

const args = process.argv.slice(2);
const flag = (name, fallback) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] ? args[i + 1] : fallback; };

const PORT = Number(flag('--port', process.env.VOICE_BRIDGE_PORT ?? 9395));
const STT_URL = process.env.STT_URL ?? 'http://127.0.0.1:8178/inference';
const STT_KIND = /\/v1\/audio\/transcriptions$/.test(new URL(STT_URL).pathname) ? 'openai' : 'whispercpp';
const STT_MODEL = process.env.STT_MODEL ?? 'whisper-1';
const STT_LANGUAGE = process.env.STT_LANGUAGE ?? 'de';
const WHISPER_MODEL = process.env.WHISPER_MODEL ?? join(homedir(), '.whisper-models', 'ggml-base.bin');
const WHISPER_SERVER = process.env.WHISPER_SERVER ?? 'whisper-server';
const GROK = (process.env.GROK_VOICE_URL ?? 'http://127.0.0.1:9381').replace(/\/+$/, '');
const REVIEW_URL = process.env.REVIEW_URL ?? 'https://servas-ai.github.io/network-canvas-oneshots/';
const ALLOWED = new Set(['https://servas-ai.github.io', ...(process.env.ALLOW_ORIGINS ?? '').split(',').map(s => s.trim()).filter(Boolean)]);
const LOOPBACK_ORIGIN = /^http:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/;
const MAX_AUDIO = 25 * 1024 * 1024;
const TOKEN = randomBytes(18).toString('base64url'); // new for every start, never stored
const CLIENT = 'oneshots-review';

const log = (entry) => process.stderr.write(`${JSON.stringify({ t: new Date().toISOString(), ...entry })}\n`); // never audio, text or token

function originAllowed(origin) {
  if (!origin) return true; // curl or a server; the token still decides
  return ALLOWED.has(origin) || LOOPBACK_ORIGIN.test(origin);
}

function tokenOk(req, url) {
  const given = String(req.headers['x-voice-token'] ?? url.searchParams.get('token') ?? '');
  const a = Buffer.from(given), b = Buffer.from(TOKEN);
  return a.length === b.length && timingSafeEqual(a, b);
}

function cors(req, res) {
  const origin = req.headers.origin;
  if (origin && originAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
}

function send(res, status, body) {
  if (res.headersSent) return;
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(body));
}

async function readBody(req, max) {
  let size = 0; const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > max) throw Object.assign(new Error('too large'), { code: 'body_too_large', status: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/* ---------- local STT (whisper.cpp or OpenAI-compatible) ---------- */
let whisperChild = null;
let sttStarting = null;

async function reachable(url, ms = 1500) {
  try { await fetch(url, { signal: AbortSignal.timeout(ms) }); return true; } catch { return false; }
}

const sttBase = () => new URL(STT_URL).origin + '/';

async function ensureStt() {
  if (await reachable(sttBase())) return { ok: true, started: false };
  if (STT_KIND !== 'whispercpp' || process.env.STT_URL) return { ok: false, code: 'stt_unreachable' };
  if (!existsSync(WHISPER_MODEL)) return { ok: false, code: 'whisper_model_missing', model: WHISPER_MODEL };
  if (!sttStarting) {
    sttStarting = (async () => {
      const u = new URL(STT_URL);
      whisperChild = spawn(WHISPER_SERVER, ['--host', '127.0.0.1', '--port', u.port || '8178', '-m', WHISPER_MODEL, '-l', STT_LANGUAGE, '--inference-path', u.pathname],
        { stdio: 'ignore' });
      whisperChild.once('error', (e) => { log({ code: 'whisper_spawn_failed', error: e.code }); whisperChild = null; });
      whisperChild.once('exit', () => { whisperChild = null; });
      for (let i = 0; i < 60 && whisperChild; i++) {
        if (await reachable(sttBase(), 500)) { log({ code: 'whisper_started', port: u.port }); return { ok: true, started: true }; }
        await new Promise(r => setTimeout(r, 500));
      }
      return { ok: false, code: 'whisper_start_failed' };
    })().finally(() => { sttStarting = null; });
  }
  return sttStarting;
}

async function transcribe(audio, type) {
  const fd = new FormData();
  fd.append('file', new Blob([audio], { type: type || 'audio/wav' }), 'passage.wav');
  fd.append('response_format', 'json');
  fd.append('language', STT_LANGUAGE);
  if (STT_KIND === 'openai') fd.append('model', STT_MODEL);
  else fd.append('temperature', '0.0');
  const t0 = Date.now();
  const r = await fetch(STT_URL, { method: 'POST', body: fd, signal: AbortSignal.timeout(120000) });
  if (!r.ok) throw Object.assign(new Error('stt failed'), { code: 'stt_failed', status: 502 });
  const data = await r.json();
  const text = String(data.text ?? '').replace(/\[[^\]]*\]|\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim(); // drop [BLANK_AUDIO], (Musik) …
  return { text, ms: Date.now() - t0 };
}

/* ---------- Grok-Voice-Harness (server side, harness origin rule untouched) ---------- */
async function grok(method, path, body) {
  const r = await fetch(GROK + '/v1/grok' + path, {
    method,
    headers: { 'X-Voice-Client': CLIENT, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(method === 'POST' ? 45000 : 4000),
  });
  return { status: r.status, data: await r.json().catch(() => ({ ok: false, code: 'bad_upstream' })) };
}

async function grokEvents(req, res) {
  const ac = new AbortController();
  req.once('close', () => ac.abort());
  let up;
  try { up = await fetch(`${GROK}/v1/grok/events?client=${CLIENT}`, { headers: { 'X-Voice-Client': CLIENT }, signal: ac.signal }); }
  catch { return send(res, 502, { ok: false, code: 'grok_unreachable' }); }
  if (!up.ok || !up.body) return send(res, 502, { ok: false, code: 'grok_events_failed', status: up.status });
  res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store, no-transform', Connection: 'keep-alive' });
  res.flushHeaders?.();
  try { for await (const chunk of up.body) res.write(chunk); } catch { /* client or harness closed */ }
  res.end();
}

/* ---------- HTTP ---------- */
const server = http.createServer(async (req, res) => {
  let url;
  try { url = new URL(req.url ?? '/', 'http://127.0.0.1'); } catch { return send(res, 400, { ok: false, code: 'bad_url' }); }
  const origin = req.headers.origin;
  const host = String(req.headers.host ?? '').split(':')[0];
  if (!['127.0.0.1', 'localhost'].includes(host)) return send(res, 403, { ok: false, code: 'host_rejected' }); // DNS rebinding
  if (!originAllowed(origin)) { log({ code: 'origin_rejected', origin }); return send(res, 403, { ok: false, code: 'origin_rejected' }); }
  cors(req, res);

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Voice-Token');
    res.setHeader('Access-Control-Max-Age', '600');
    if (req.headers['access-control-request-private-network']) res.setHeader('Access-Control-Allow-Private-Network', 'true');
    res.writeHead(204); return res.end();
  }

  const authed = tokenOk(req, url);
  try {
    if (req.method === 'GET' && url.pathname === '/health') {
      if (!authed) return send(res, 200, { ok: true, bridge: 'oneshots-review-voice', paired: false });
      const [stt, grokUp] = await Promise.all([reachable(sttBase()), grok('GET', '/status').catch(() => null)]);
      return send(res, 200, {
        ok: true, bridge: 'oneshots-review-voice', paired: true,
        stt: { kind: STT_KIND, url: STT_URL, reachable: stt, autostart: STT_KIND === 'whispercpp' && !process.env.STT_URL && existsSync(WHISPER_MODEL) },
        grok: grokUp ? { url: GROK, reachable: true, consent: grokUp.data.consent ?? null, login: grokUp.data.login?.state ?? null, live: !!grokUp.data.live } : { url: GROK, reachable: false },
      });
    }
    if (!authed) { log({ code: 'token_rejected', path: url.pathname }); return send(res, 403, { ok: false, code: 'token_required' }); }

    if (req.method === 'POST' && url.pathname === '/stt') {
      const audio = await readBody(req, MAX_AUDIO);
      if (audio.length < 1000) return send(res, 400, { ok: false, code: 'audio_too_short' });
      const ready = await ensureStt();
      if (!ready.ok) return send(res, 503, { ok: false, ...ready });
      const out = await transcribe(audio, req.headers['content-type']);
      log({ code: 'transcribed', bytes: audio.length, ms: out.ms, chars: out.text.length });
      return send(res, 200, { ok: true, text: out.text, ms: out.ms, engine: STT_KIND });
    }
    if (url.pathname === '/grok/events' && req.method === 'GET') return grokEvents(req, res);
    const grokRoute = { 'GET /grok/status': ['GET', '/status'], 'POST /grok/start': ['POST', '/start'], 'POST /grok/stop': ['POST', '/stop'] }[`${req.method} ${url.pathname}`];
    if (grokRoute) {
      const body = grokRoute[0] === 'POST' ? (url.pathname === '/grok/start' ? { mic: 'real' } : {}) : undefined;
      const r = await grok(grokRoute[0], grokRoute[1], body).catch(() => ({ status: 502, data: { ok: false, code: 'grok_unreachable' } }));
      return send(res, r.status, r.data);
    }
    return send(res, 404, { ok: false, code: 'not_found' });
  } catch (error) {
    log({ code: error.code ?? 'internal_error' });
    return send(res, error.status ?? 500, { ok: false, code: error.code ?? 'internal_error' });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  const pair = `${PORT}.${TOKEN}`;
  process.stdout.write(`${JSON.stringify({ ok: true, bridge: `http://127.0.0.1:${PORT}`, pairing: pair, stt: STT_URL, grok: GROK })}\n`);
  process.stdout.write(`\nKopplungscode: ${pair}\nÜbersicht gekoppelt öffnen: ${REVIEW_URL}#voice=${pair}\n`);
  if (args.includes('--open')) execFile(process.platform === 'darwin' ? 'open' : 'xdg-open', [`${REVIEW_URL}#voice=${pair}`], () => {});
});

const stop = () => { whisperChild?.kill(); server.close(); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
