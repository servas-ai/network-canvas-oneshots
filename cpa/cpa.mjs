// SERVAS-2071 functional CPA Manager Plus gateway overview (replaces the
// cpa-manager-plus.html mockup data). Data: GET /api/gateways (TCP probes of
// CLIProxyAPI and OpenCodex) and GET /api/usage?days=N (local session logs:
// requests, tokens, failed calls, newest requests).
// Cost, latency and per-request accounts have no source: UNKNOWN, never
// mockup values. Codex does not log failed calls, so its success rate is
// UNKNOWN too, not 100 %.
import { observe } from '../shared/state.mjs';
import { successRate, failureClasses, rollingHours, cacheRate, coverage } from '../shared/usage.mjs';
import { el, icon, stateBadge, panel, metric, meter, table, bars, fmt } from '../shared/components.mjs';
import { mountPage, getJson } from '../shared/page.mjs';

const USAGE_MAX_AGE = 24 * 3600e3;
const SOURCES = Object.freeze({ claude: 'Claude Code', codex: 'Codex CLI' });
let nodes = null, usage = null, view = 'all', days = 1;

const pct = v => (v === null ? '–' : `${v.toLocaleString('de-AT', { maximumFractionDigits: 2 })} %`);
const count = v => (Number.isFinite(v) ? v.toLocaleString('de-AT') : '–');
const span = () => (days === 1 ? '24 h' : `${days} Tage`);
const latest = data => data.sources.map(s => s.observedAt).filter(Boolean).sort().at(-1);
const unknownBadge = now => stateBadge(observe({}, { now }));
const time = iso => (Number.isFinite(Date.parse(iso)) ? new Date(iso).toLocaleTimeString('de-AT') : '–');
const statusLabel = s => (s === 'ok' ? 'OK' : s);

function nodeObs(n, now) {
  return observe({ source: `tcp:${n.host}:${n.port}`, observedAt: n.checkedAt, value: n.reachable }, { now, maxAgeMs: 5 * 60e3 });
}

function sourceObs(s, now) {
  return observe({ source: `log:${s.id}`, observedAt: s.observedAt, value: s.records }, { now, maxAgeMs: USAGE_MAX_AGE });
}

function overviewMetrics(now) {
  const t = usage.totals, sr = successRate(usage, 'claude');
  const failed = (usage.failures ?? []).reduce((s, f) => s + f.count, 0);
  const obs = observe({ source: 'local-session-logs', observedAt: latest(usage), value: t.requests }, { now, maxAgeMs: USAGE_MAX_AGE });
  return el('div', { class: 'grid4' },
    el('div', { class: 'ui-panel ui-metric' }, el('small', { text: `Anfragen · ${span()}` }),
      el('div', { class: 'value', text: count(t.requests) }), el('div', {}, stateBadge(obs)),
      el('small', { text: `${count(failed)} fehlgeschlagen (nur Claude Code protokolliert)` })),
    el('div', { class: 'ui-panel ui-metric' }, el('small', { text: 'Erfolgsquote · Claude Code' }),
      el('div', { class: 'value', text: pct(sr.rate) }),
      el('small', { text: sr.rate === null ? 'Keine Claude-Code-Anfragen im Zeitraum' : `${count(sr.ok)} ok · ${count(sr.failed)} fehlgeschlagen` }),
      el('div', {}, el('small', { text: 'Codex: unbekannt, Fehler werden nicht protokolliert' }))),
    metric('Tokens gesamt', fmt.tokens(t.total), `${fmt.tokens(t.input + t.cachedInput)} Eingabe · ${fmt.tokens(t.output)} Ausgabe`),
    el('div', { class: 'ui-panel ui-metric' }, el('small', { text: 'Geschätzte Kosten' }),
      el('div', { class: 'value', text: '–' }), el('div', {}, unknownBadge(now)),
      el('small', { text: 'Keine belegte Preistabelle; Abos sind keine Kosten je Anfrage.' })));
}

function trafficPanel(now) {
  const obs = observe({ source: 'local-session-logs', observedAt: latest(usage), value: usage.totals.requests }, { now, maxAgeMs: USAGE_MAX_AGE });
  if (days === 1) {
    const hours = rollingHours(usage.requestsByHourUtc ?? [], now);
    return panel('Verkehr · letzte 24 h', stateBadge(obs),
      hours.length ? bars(hours, 'Anfragen je Stunde, letzte 24 h (UTC)', count) : el('div', { class: 'ui-empty', text: 'Server liefert keine Anfragen je Stunde' }),
      hours.length ? el('div', { class: 'axis' }, el('small', { text: hours[0].label }), el('small', { text: hours[12].label }), el('small', { text: `${hours.at(-1).label} (laufend)` })) : null,
      el('small', { text: 'Anfragen je Stunde · Latenz (P95) unbekannt: die Logs enthalten keine Antwortzeiten' }));
  }
  const pts = usage.byDay.map(d => ({ label: fmt.day(d.day), value: d.requests ?? 0 }));
  const cov = coverage(usage.byDay);
  return panel(`Verkehr · ${span()}`, stateBadge(obs),
    cov.covered < cov.days ? el('div', { class: 'ui-empty', dataset: { state: 'stale' }, text: cov.firstDay
      ? `Logdaten erst ab ${fmt.day(cov.firstDay)} (${cov.covered} Tage). Davor keine Einträge: ältere Logs fehlen oder es gab keine Nutzung.`
      : `Keine Logdaten in ${span()}.` }) : null,
    bars(pts, `Anfragen je Tag, ${span()}`, count),
    pts.length ? el('div', { class: 'axis' }, el('small', { text: pts[0].label }), el('small', { text: `${pts.at(-1).label} (laufend)` })) : null,
    el('small', { text: 'Anfragen je UTC-Tag · Latenz (P95) unbekannt: die Logs enthalten keine Antwortzeiten' }));
}

function nodesPanel(now) {
  const rows = [
    ...nodes.nodes.map(n => {
      const obs = nodeObs(n, now);
      return el('div', { class: 'row' }, el('div', { class: 'between' }, el('strong', { text: n.label }),
        obs.state === 'ready' ? el('span', { class: 'ui-badge', role: 'status', dataset: { state: n.reachable ? 'ready' : 'error' } },
          icon(n.reachable ? 'circle-check' : 'triangle-alert'), n.reachable ? 'Erreichbar' : 'Nicht erreichbar') : stateBadge(obs)),
      el('small', { class: 'mono', text: n.reachable ? `127.0.0.1:${n.port} · TCP ${n.latencyMs} ms · keine Anfrage gesendet` : `Kein Dienst auf 127.0.0.1:${n.port}` }));
    }),
    ...usage.sources.map(s => el('div', { class: 'row' }, el('div', { class: 'between' }, el('strong', { text: `Log · ${SOURCES[s.id] ?? s.id}` }), stateBadge(sourceObs(s, now))),
      el('small', { text: s.observedAt ? `${count(s.records)} Anfragen · letzte ${fmt.dateTime(s.observedAt)}` : `Keine Anfrage in ${span()}` }))),
  ];
  return panel('Knoten', el('small', { text: 'TCP-Probe und Log-Frische' }), rows);
}

function mixPanel() {
  const t = usage.totals, sum = t.input + t.cachedInput + t.output;
  const share = v => (sum > 0 ? (v / sum) * 100 : null);
  const cache = cacheRate(t);
  return panel('Token-Mix', null, el('div', { class: 'mix' }, [['Eingabe', t.input], ['Eingabe aus Cache', t.cachedInput], ['Ausgabe', t.output]].map(([label, v]) =>
    el('div', { class: 'share' }, el('div', { class: 'between' }, el('small', { text: label }), el('strong', { text: `${fmt.tokens(v)} · ${pct(share(v) === null ? null : Math.round(share(v) * 10) / 10)}` })),
      meter(share(v), `${label}, Anteil an allen Tokens`, 'share')))),
  el('small', { text: cache === null ? 'Cache-Quote unbekannt' : `Cache-Quote der Eingabe ${pct(Math.round(cache * 10) / 10)}` }));
}

function failuresPanel(now) {
  const classes = failureClasses(usage.failures ?? []);
  return panel('Fehleraufschlüsselung', el('small', { text: span() }),
    classes.length ? el('div', { class: 'scroll' }, table([
      { key: 'label', label: 'Fehlerklasse' },
      { key: 'count', label: 'Anfragen', num: true, format: count },
      { key: 'lastAt', label: 'Zuletzt', format: fmt.dateTime },
    ], classes)) : el('div', { class: 'ui-empty', text: `Keine fehlgeschlagenen Claude-Code-Anfragen in ${span()}` }),
    el('div', { class: 'row' }, el('div', { class: 'between' }, el('strong', { text: 'Codex-Fehler' }), unknownBadge(now)),
      el('small', { text: 'Codex CLI schreibt fehlgeschlagene Aufrufe nicht ins Session-Log.' })));
}

function requestsPanel(now) {
  return panel('Letzte Anfragen', el('small', { text: `neueste ${usage.recent?.length ?? 0}` }),
    el('div', { class: 'scroll' }, table([
      { key: 'at', label: 'Zeit', format: time },
      { key: 'source', label: 'Quelle', format: v => SOURCES[v] ?? v },
      { key: 'model', label: 'Modell', format: v => v ?? '–' },
      { key: 'status', label: 'Status', format: statusLabel },
      { key: 'total', label: 'Tokens', num: true, format: count },
    ], usage.recent ?? [], `Keine Anfragen in ${span()}`)),
    el('div', { class: 'row' }, el('div', { class: 'between' }, el('strong', { text: 'Konto, Latenz, Kosten je Anfrage' }), unknownBadge(now)),
      el('small', { text: 'Nicht in den Logs; ohne CLIProxy-Management-Key (menschliche Freigabe) keine Request-Logs des Gateways. Keine Anfrage-IDs oder Inhalte angezeigt.' })));
}

function render({ gateways, usage: u }, { now }) {
  nodes = gateways; usage = u;
  const views = {
    all: () => [overviewMetrics(now), el('div', { class: 'split' }, trafficPanel(now), nodesPanel(now)),
      el('div', { class: 'split' }, requestsPanel(now), el('div', { style: 'display:grid;gap:12px' }, mixPanel(), failuresPanel(now)))],
    requests: () => [requestsPanel(now)],
    failures: () => [failuresPanel(now)],
  };
  return el('div', { style: 'display:grid;gap:12px' }, views[view]());
}

const page = mountPage({
  // sequential: the server runs one collection at a time
  fetchData: async () => ({ gateways: await getJson('/api/gateways'), usage: await getJson(`/api/usage?days=${days}`) }),
  render,
  exportFile: d => ({ name: `cpa-gateway-${d.usage.generatedAt.slice(0, 10)}-${days}d.json`, data: d }),
  onView: v => { view = v; },
  poll: 'Abfrage jede Minute', pollMs: 60e3, tickMs: 30e3,
});
document.getElementById('window').addEventListener('change', e => { days = Number(e.target.value); page.reload(); });
