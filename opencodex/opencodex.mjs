// SERVAS-2071 functional OpenCodex account dashboard (replaces the opencodex.html
// mockup data). Data: GET /api/opencodex (gateway TCP probe + Codex model
// catalogue), GET /api/usage?days=1 (24 h activity) and ?days=2 (today vs.
// the full previous UTC day, quota windows of the last 2 days).
// Pool accounts beyond the local Codex login, routing/auto-switch settings and
// 429 failover have no adapter: UNKNOWN, never mockup values.
import { observe } from '../shared/state.mjs';
import { trayModel, poolCapacity } from '../shared/quota.mjs';
import { dayCompare, rollingHours } from '../shared/usage.mjs';
import { el, stateBadge, panel, metric, meter, table, bars, fmt } from '../shared/components.mjs';
import { mountPage, getJson } from '../shared/page.mjs';

const USAGE_MAX_AGE = 24 * 3600e3;
const CATALOG_MAX_AGE = 7 * 24 * 3600e3;
let oc = null, usage = null, twoDays = null, view = 'all';

const pct = v => (v === null ? '–' : `${v.toLocaleString('de-AT', { maximumFractionDigits: 0 })} %`);
const count = v => (Number.isFinite(v) ? v.toLocaleString('de-AT') : '–');
const latest = data => data.sources.map(s => s.observedAt).filter(Boolean).sort().at(-1);
const unknownBadge = now => stateBadge(observe({}, { now }));

function gatewayObs(now) {
  const g = oc.gateway;
  return observe({ source: `tcp:${g.host}:${g.port}`, observedAt: g.checkedAt, value: g.reachable }, { now, maxAgeMs: 5 * 60e3 });
}

function catalogObs(now) {
  const c = oc.catalog;
  return observe({ source: 'codex-models-cache', observedAt: c?.fetchedAt, value: c ? c.models.length : null }, { now, maxAgeMs: CATALOG_MAX_AGE });
}

function overviewMetrics(now) {
  const g = oc.gateway, gObs = gatewayObs(now);
  const req = dayCompare(twoDays.byDay, 'requests');
  const cat = catalogObs(now);
  const pool = poolCapacity(trayModel(twoDays.quotas, { now }));
  return el('div', { class: 'grid4' },
    el('div', { class: 'ui-panel ui-metric' }, el('small', { text: 'Gateway' }),
      el('div', { class: 'value', text: gObs.state !== 'ready' ? '–' : g.reachable ? 'Erreichbar' : 'Nicht erreichbar' }),
      el('div', {}, stateBadge(gObs)),
      el('small', { text: g.reachable ? `TCP 127.0.0.1:${g.port} offen · ${g.latencyMs} ms · keine Anfrage gesendet` : `Kein Dienst auf 127.0.0.1:${g.port}` })),
    metric('Anfragen heute (UTC)', count(req.today), req.yesterday === null ? 'Gestern: keine Daten' : `Gestern gesamt ${count(req.yesterday)}`),
    el('div', { class: 'ui-panel ui-metric' }, el('small', { text: 'Modelle im Katalog' }),
      el('div', { class: 'value', text: cat.value === null ? '–' : String(cat.value) }),
      el('div', {}, stateBadge(cat)), el('small', { text: oc.catalog?.fetchedAt ? `Abgeglichen ${fmt.dateTime(oc.catalog.fetchedAt)}` : 'Kein Codex-Modellkatalog' })),
    el('div', { class: 'ui-panel ui-metric' }, el('small', { text: 'Pool-Kapazität' }),
      el('div', { class: 'value', text: pool.available === null ? '–' : `${pct(pool.available)} frei` }),
      el('small', { text: `${pool.known} von ${pool.accounts} Konto mit aktuellen Fenstern · Pool sonst unbekannt` })));
}

function accountsPanel(now) {
  const model = trayModel(twoDays.quotas, { now });
  const accounts = model.providers.filter(p => p.id === 'codex').flatMap(p => p.accounts);
  return panel('Codex-Konten-Pool', el('span', { class: 'ui-badge', text: `${accounts.length} Konto beobachtet` }),
    accounts.length ? accounts.map(a => {
      const next = a.windows.map(w => w.remainingMs).filter(v => v !== null).sort((x, y) => x - y)[0] ?? null;
      return el('div', { class: 'row' },
        el('div', { class: 'between' }, el('div', {}, el('strong', { text: 'Lokales Codex-Login' }), el('small', { class: 'mono', text: ` ${a.limitId}` })),
          el('small', { text: `Plan ${a.plan ?? 'unbekannt'} · nächster Reset ${next === null ? 'unbekannt' : `in ${fmt.remaining(next)}`}` })),
        el('div', { class: 'wins' }, a.windows.map(w => el('div', { class: 'share' },
          el('div', { class: 'between' }, el('small', { text: `${w.windowMinutes ? fmt.window(w.windowMinutes) : w.name} verbraucht` }),
            el('strong', { text: pct(w.obs.value) })),
          meter(w.obs.value, `${a.limitId} ${w.windowMinutes ? fmt.window(w.windowMinutes) : w.name} verbraucht`),
          el('div', { class: 'between' }, el('small', { text: w.expired ? 'Zurückgesetzt' : w.resetsAt ? `Reset ${fmt.dateTime(w.resetsAt)}` : 'Reset unbekannt' }), stateBadge(w.obs))))),
        el('small', { text: `Beobachtet ${fmt.dateTime(a.observedAt)} · Routing-Status unbekannt` }));
    }) : el('div', { class: 'ui-empty', text: 'In den letzten 2 Tagen keine Quota-Beobachtung des lokalen Codex-Logins.' }),
    el('div', { class: 'row' }, el('div', { class: 'between' }, el('strong', { text: 'Weitere Pool-Konten' }), unknownBadge(now)),
      el('small', { text: 'Kein Adapter: Der OpenCodex-Pool ist auf dieser Maschine nicht angebunden. Konten werden nicht aus dem Mockup übernommen.' })));
}

function activityPanel(now) {
  const hours = rollingHours(usage.requestsByHourUtc ?? [], now);
  const obs = observe({ source: 'local-session-logs', observedAt: latest(usage), value: usage.totals.requests }, { now, maxAgeMs: USAGE_MAX_AGE });
  const peak = hours.reduce((m, h) => (h.value > m.value ? h : m), { value: 0, label: '–' });
  return panel('Anfragen · letzte 24 h', stateBadge(obs),
    hours.length ? bars(hours, 'Anfragen je Stunde, letzte 24 h (UTC)', count) : el('div', { class: 'ui-empty', text: 'Server liefert keine Anfragen je Stunde' }),
    hours.length ? el('div', { class: 'axis' }, el('small', { text: hours[0].label }), el('small', { text: hours[12].label }), el('small', { text: `${hours.at(-1).label} (laufend)` })) : null,
    el('small', { text: peak.value ? `Spitze ${count(peak.value)} Anfragen um ${peak.label} · Codex CLI und Claude Code dieser Maschine` : 'Keine Anfragen im Zeitraum' }));
}

function settingsPanel(now) {
  const models = oc.catalog?.models ?? [];
  const def = models[0] ?? null;
  return panel('Delegation & Routing', null,
    el('div', { class: 'row' }, el('div', { class: 'between' }, el('strong', { text: 'Standardmodell im Katalog' }), stateBadge(catalogObs(now))),
      el('small', { class: 'mono', text: def ? `${def.name} · Effort ${def.defaultEffort ?? 'unbekannt'}` : '–' })),
    [['Sub-Agent-Modell', 'In OpenCodex konfiguriert, kein lesender Adapter.'],
      ['Auto-Wechsel bei 429', 'Failover-Status des Pools nicht angebunden.'],
      ['Websuche', 'Sidecar-Konfiguration nicht angebunden.']].map(([label, why]) =>
      el('div', { class: 'row' }, el('div', { class: 'between' }, el('strong', { text: label }), unknownBadge(now)), el('small', { text: why }))),
    el('div', { class: 'row' }, el('small', { text: 'Diese Oberfläche ist nur lesend: Der lokale Server hat keine Schreib-Endpunkte.' })));
}

function modelsPanel(now) {
  const models = oc.catalog?.models ?? [];
  const used = new Set(usage.byModel.map(r => r.model));
  return panel('Modellkatalog', el('div', { class: 'between' }, el('small', { text: oc.catalog?.clientVersion ? `Codex ${oc.catalog.clientVersion}` : '' }), stateBadge(catalogObs(now))),
    el('div', { class: 'scroll' }, table([
      { key: 'name', label: 'Modell' }, { key: 'slug', label: 'ID', format: v => v },
      { key: 'visibility', label: 'Sichtbarkeit', format: v => ({ list: 'gelistet', hide: 'verborgen' }[v] ?? v ?? '–') },
      { key: 'slug', label: 'Genutzt (24 h)', format: v => (used.has(v) ? 'ja' : 'nein') },
      { key: 'efforts', label: 'Reasoning-Stufen', format: (v, r) => v.map(e => (e === r.defaultEffort ? `${e}*` : e)).join(' · ') || '–' },
    ], models, 'Kein Codex-Modellkatalog auf dieser Maschine')),
    el('small', { text: '* Standardstufe des Modells. Genutzt: Codex-Anfragen dieser Maschine in 24 h. Quelle: lokaler Codex-Modellkatalog, ohne Konto-Kennung.' }));
}

function render(data, { now }) {
  ({ oc, usage, twoDays } = data);
  const views = {
    all: () => [overviewMetrics(now), el('div', { class: 'split' }, activityPanel(now), settingsPanel(now)), accountsPanel(now)],
    accounts: () => [accountsPanel(now)],
    models: () => [modelsPanel(now)],
  };
  return el('div', { style: 'display:grid;gap:12px' }, views[view]());
}

mountPage({
  // sequential: the server runs one collection at a time
  fetchData: async () => ({ oc: await getJson('/api/opencodex'), usage: await getJson('/api/usage?days=1'), twoDays: await getJson('/api/usage?days=2') }),
  render,
  exportFile: d => ({ name: `opencodex-${d.oc.generatedAt.slice(0, 10)}.json`, data: { opencodex: d.oc, last24h: d.usage, last2d: d.twoDays } }),
  onView: v => { view = v; },
  poll: 'Abfrage jede Minute', pollMs: 60e3, tickMs: 30e3,
});
