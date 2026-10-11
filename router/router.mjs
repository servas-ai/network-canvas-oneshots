// SERVAS-2071 functional Claude Code Router surface (replaces the
// claude-code-router.html mockup data). Data: GET /api/router (whitelisted CCR
// config + TCP probe of the router port) and GET /api/usage?days=N (Claude Code
// session logs: requests, prompt sizes, failed calls, newest requests).
// Routes are what CCR would pick with this config, never a claim that a
// request went through the router. Latency, retries and think/web-search
// matches have no source: UNKNOWN, never mockup values.
import { observe } from '../shared/state.mjs';
import { failureClasses } from '../shared/usage.mjs';
import { routeFor, threshold, ruleHits, share } from '../shared/route.mjs';
import { el, icon, stateBadge, panel, metric, table, bars, fmt } from '../shared/components.mjs';
import { mountPage, getJson } from '../shared/page.mjs';

const USAGE_MAX_AGE = 24 * 3600e3;
const RULES = Object.freeze([
  ['default', 'Default', 'Alle übrigen Anfragen'],
  ['background', 'Background', 'Haiku-Anfragen von Claude Code'],
  ['think', 'Think', 'Anfragen mit Thinking'],
  ['longContext', 'Long context', 'Eingabe über der Schwelle'],
  ['webSearch', 'Web search', 'Anfragen mit Websuche-Tool'],
]);
const LABEL = Object.fromEntries(RULES.map(([k, l]) => [k, l]));
let router = null, usage = null, view = 'all', days = 1;

const count = v => (Number.isFinite(v) ? v.toLocaleString('de-AT') : '–');
const pct = v => (Number.isFinite(v) ? `${v.toLocaleString('de-AT', { maximumFractionDigits: 1 })} %` : '–');
const span = () => (days === 1 ? '24 h' : `${days} Tage`);
const time = iso => (Number.isFinite(Date.parse(iso)) ? new Date(iso).toLocaleTimeString('de-AT') : '–');
const unknownBadge = now => stateBadge(observe({}, { now }));
const claudeSource = () => usage.sources.find(s => s.id === 'claude');
const config = () => router.config;
const rules = () => (config()?.valid ? config().rules : null);
const limit = () => threshold(config());
const limitText = () => `${count(limit())} Tokens${config()?.longContextThreshold ? '' : ' (CCR-Standard)'}`;

function badge(state, iconName, text) {
  return el('span', { class: 'ui-badge', role: 'status', dataset: { state } }, icon(iconName), text);
}

function serviceObs(now) {
  const s = router.service;
  return observe({ source: `tcp:${s.host}:${s.port}`, observedAt: s.checkedAt, value: s.reachable }, { now, maxAgeMs: 5 * 60e3 });
}

function serviceBadge(now) {
  const obs = serviceObs(now), s = router.service;
  if (obs.state !== 'ready') return stateBadge(obs);
  return s.reachable ? badge('ready', 'circle-check', 'Läuft') : badge('error', 'triangle-alert', 'Nicht erreichbar');
}

function configBadge(now) {
  const c = config();
  if (!c) return unknownBadge(now);
  return c.valid ? badge('ready', 'circle-check', 'Gültig') : badge('error', 'triangle-alert', 'Ungültiges JSON');
}

function configHint() {
  const c = config();
  if (!c) return '~/.claude-code-router/config.json fehlt: CCR ist hier nicht eingerichtet.';
  if (!c.valid) return `config.json lässt sich nicht lesen · geändert ${fmt.dateTime(c.modifiedAt)}`;
  return `${count(c.providers.length)} Provider · geändert ${fmt.dateTime(c.modifiedAt)}`;
}

function notice(now) {
  const s = router.service, c = config();
  const def = rules()?.default;
  return el('section', { class: 'ui-panel' }, el('div', { class: 'between' },
    el('div', {}, el('strong', { text: s.reachable ? `Router lauscht auf 127.0.0.1:${s.port}` : `Kein Router auf 127.0.0.1:${s.port}` }),
      el('div', {}, el('small', { text: def ? `Default-Route: ${def.provider},${def.model} · Konfiguration gültig` : c ? configHint() : 'Keine CCR-Konfiguration · Routen unten zeigen, was CCR mit Standardwerten wählen würde' }))),
    serviceBadge(now)));
}

function metrics(now) {
  const src = claudeSource(), hits = ruleHits(usage, config());
  const obs = observe({ source: 'log:claude', observedAt: src?.observedAt, value: hits.requests }, { now, maxAgeMs: USAGE_MAX_AGE });
  return el('div', { class: 'grid4' },
    el('div', { class: 'ui-panel ui-metric' }, el('small', { text: 'Router-Dienst' }),
      el('div', { class: 'value mono', text: `:${router.service.port}` }), el('div', {}, serviceBadge(now)),
      el('small', { text: router.service.reachable ? `TCP ${router.service.latencyMs} ms · keine Anfrage gesendet` : 'TCP-Probe ohne Antwort · keine Anfrage gesendet' })),
    el('div', { class: 'ui-panel ui-metric' }, el('small', { text: 'Konfiguration' }),
      el('div', { class: 'value', text: config()?.valid ? count(config().providers.length) : '–' }), el('div', {}, configBadge(now)),
      el('small', { text: configHint() })),
    el('div', { class: 'ui-panel ui-metric' }, el('small', { text: `Claude-Code-Anfragen · ${span()}` }),
      el('div', { class: 'value', text: count(hits.requests) }), el('div', {}, stateBadge(obs)),
      el('small', { text: src?.observedAt ? `letzte ${fmt.dateTime(src.observedAt)}` : `Keine Anfrage in ${span()}` })),
    metric(`Über Long-context-Schwelle · ${span()}`, pct(share(hits.hits.longContext, usage.claudePrompts)),
      hits.hits.longContext === null ? `Schwelle ${limitText()} ist keine Histogrammkante: unbekannt` : `${count(hits.hits.longContext)} Anfragen über ${limitText()}`));
}

function ruleTarget(key, now) {
  const r = rules();
  if (!r) return config() ? badge('error', 'triangle-alert', 'Nicht lesbar') : unknownBadge(now);
  const t = r[key];
  if (!t) return el('small', { text: key === 'default' ? 'Nicht gesetzt' : 'Nicht konfiguriert → default' });
  return el('div', { style: 'text-align:right' }, el('strong', { class: 'mono', text: t.model }), el('div', {}, el('small', { text: t.provider })));
}

function rulesPanel(now) {
  const hits = ruleHits(usage, config());
  const why = { think: 'Thinking-Anforderung steht nicht im Log', webSearch: 'Tool-Liste der Anfrage steht nicht im Log',
    background: 'Hintergrundaufrufe schreibt Claude Code nicht ins Session-Log', longContext: `über ${limitText()}`, default: 'alle Claude-Code-Anfragen' };
  return panel('Routing-Regeln', el('small', { text: `Treffer · ${span()}` }), RULES.map(([key, label, desc]) =>
    el('div', { class: 'row' },
      el('div', { class: 'between' }, el('div', {}, el('strong', { text: label }), el('div', {}, el('small', { text: desc }))), ruleTarget(key, now)),
      el('div', { class: 'between' },
        el('small', { text: hits.hits[key] === null ? `Passende Anfragen unbekannt: ${why[key]}` : `${count(hits.hits[key])} passende Anfragen · ${why[key]}` }),
        hits.routed[key] === null && hits.hits[key] !== null ? el('small', { text: 'Zuordnung unbekannt (Überschneidung)' })
          : hits.routed[key] !== null ? el('small', { text: `→ ${count(hits.routed[key])} geroutet` }) : unknownBadge(now)))));
}

function promptPanel(now) {
  const buckets = usage.claudePrompts ?? [];
  const label = (b, i) => (b.upTo === null ? `> ${fmt.tokens(buckets[i - 1]?.upTo ?? 0)}` : `≤ ${fmt.tokens(b.upTo)}`);
  const pts = buckets.map((b, i) => ({ label: label(b, i), value: b.requests }));
  const obs = observe({ source: 'log:claude', observedAt: claudeSource()?.observedAt, value: buckets.length }, { now, maxAgeMs: USAGE_MAX_AGE });
  return panel('Eingabegröße je Anfrage', stateBadge(obs),
    pts.length ? bars(pts, `Claude-Code-Anfragen nach Eingabetokens, ${span()}`, count) : el('div', { class: 'ui-empty', text: 'Server liefert keine Eingabegrößen' }),
    pts.length ? el('div', { class: 'axis' }, pts.map(p => el('small', { text: p.label }))) : null,
    el('small', { text: `Eingabe = frische + Cache-Tokens laut API. CCR zählt selbst per Tokenizer; die Schwelle ${limitText()} ist daher eine Näherung.` }));
}

function streamPanel(now) {
  const rows = (usage.recent ?? []).filter(r => r.source === 'claude').map(r => ({
    ...r, route: r.status === 'ok' ? routeFor(r, rules() ?? {}, limit()) : null,
  }));
  return panel('Anfragen', el('small', { text: `neueste ${rows.length} von Claude Code` }),
    el('div', { class: 'scroll' }, table([
      { key: 'at', label: 'Zeit', format: time },
      { key: 'model', label: 'Modell', format: v => v ?? '–' },
      { key: 'prompt', label: 'Eingabe', num: true, format: v => fmt.tokens(v) },
      { key: 'route', label: 'Route (CCR)', format: v => (v ? LABEL[v] : '–') },
      { key: 'status', label: 'Status', format: v => (v === 'ok' ? 'OK' : v) },
    ], rows, `Keine Claude-Code-Anfragen in ${span()}`)),
    el('div', { class: 'row' }, el('div', { class: 'between' }, el('strong', { text: 'Latenz und tatsächlicher Weg' }), unknownBadge(now)),
      el('small', { text: router.service.reachable
        ? 'Route = was CCR mit dieser Konfiguration wählen würde. Ob Claude Code über den Router lief, steht nicht im Log; Latenz ebenfalls nicht.'
        : 'Router nicht erreichbar: diese Anfragen liefen nicht über CCR. Route zeigt, was CCR wählen würde. Latenz steht nicht im Log.' })));
}

function providersPanel(now) {
  const c = config();
  if (!c?.valid) return panel('Provider und Transformer', c ? configBadge(now) : unknownBadge(now), el('div', { class: 'ui-empty', text: configHint() }));
  return panel('Provider und Transformer', el('small', { text: 'nur Namen; Schlüssel und URLs werden nie gelesen' }),
    el('div', { class: 'scroll' }, table([
      { key: 'name', label: 'Provider' },
      { key: 'models', label: 'Modelle', format: v => (v.length ? v.join(', ') : '–') },
      { key: 'transformers', label: 'Transformer', format: v => (v.length ? v.join(', ') : 'keine') },
    ], c.providers, 'Keine Provider eingetragen')));
}

function limitsPanel(now) {
  const c = config()?.valid ? config() : null;
  const limited = failureClasses((usage.failures ?? []).filter(f => f.source === 'claude' && (f.status === 429 || /rate|overload/.test(f.error))));
  const n = limited.reduce((s, f) => s + f.count, 0);
  return panel('Rate-Limits und Timeout', null,
    el('div', { class: 'row' }, el('div', { class: 'between' }, el('strong', { text: 'Request-Timeout' }),
      c?.timeoutMs ? el('span', { class: 'mono', text: `${count(c.timeoutMs)} ms` }) : unknownBadge(now)),
      el('small', { text: c?.timeoutMs ? 'API_TIMEOUT_MS aus config.json' : 'API_TIMEOUT_MS nicht gesetzt oder keine Konfiguration' })),
    el('div', { class: 'row' }, el('div', { class: 'between' }, el('strong', { text: `Rate-Limit-Fehler · ${span()}` }), el('strong', { text: count(n) })),
      el('small', { text: n ? `zuletzt ${fmt.dateTime(limited.map(f => f.lastAt).sort().at(-1))} · aus dem Claude-Code-Log (HTTP 429 / rate / overload)` : 'Keine im Claude-Code-Log' })),
    el('div', { class: 'row' }, el('div', { class: 'between' }, el('strong', { text: 'Backoff und Wiederholungen' }), unknownBadge(now)),
      el('small', { text: 'Keine belegte Quelle: weder config.json noch das Session-Log nennen Wiederholungen.' })));
}

function render({ router: r, usage: u }, { now }) {
  router = r; usage = u;
  const views = {
    all: () => [notice(now), metrics(now), el('div', { class: 'split' }, rulesPanel(now), promptPanel(now)),
      streamPanel(now), el('div', { class: 'split' }, providersPanel(now), limitsPanel(now))],
    stream: () => [streamPanel(now)],
    config: () => [rulesPanel(now), el('div', { class: 'split' }, providersPanel(now), limitsPanel(now))],
  };
  return el('div', { style: 'display:grid;gap:12px' }, views[view]());
}

const page = mountPage({
  // sequential: the server runs one collection at a time
  fetchData: async () => ({ router: await getJson('/api/router'), usage: await getJson(`/api/usage?days=${days}`) }),
  render,
  exportFile: d => ({ name: `claude-code-router-${d.usage.generatedAt.slice(0, 10)}-${days}d.json`, data: d }),
  onView: v => { view = v; },
  poll: 'Abfrage jede Minute', pollMs: 60e3, tickMs: 30e3,
});
document.getElementById('window').addEventListener('change', e => { days = Number(e.target.value); page.reload(); });
