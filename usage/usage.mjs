// SERVAS-2071 functional CLIProxyAPI Usage (replaces the cliproxyapi-usage.html
// mockup data). Data: GET /api/usage (app/server.mjs) for 24 h and 30 days;
// analytics from shared/usage.mjs, quota windows from shared/quota.mjs.
// Spend, CLIProxy pool accounts and other machines have no adapter: UNKNOWN.
import { observe } from '../shared/state.mjs';
import { trayModel } from '../shared/quota.mjs';
import { cacheRate, dayCompare, rollingHours, shares } from '../shared/usage.mjs';
import { el, stateBadge, panel, metric, meter, table, bars, fmt } from '../shared/components.mjs';
import { mountPage, getJson } from '../shared/page.mjs';

const USAGE_MAX_AGE = 24 * 3600e3;
let day = null, month = null, view = 'all';

const pct = v => (v === null ? '–' : `${v.toLocaleString('de-AT', { maximumFractionDigits: 1 })} %`);
const count = v => v.toLocaleString('de-AT');
const CLIENTS = { codex: 'Codex CLI', claude: 'Claude Code' };
const latest = data => data.sources.map(s => s.observedAt).filter(Boolean).sort().at(-1);

function overviewMetrics(now) {
  const cmp = dayCompare(month.byDay);
  const bySource = shares(day.byModel, 'source');
  const rate = cacheRate(day.totals);
  return el('div', { class: 'grid4' },
    metric('Tokens heute (UTC)', fmt.tokens(cmp.today), cmp.yesterday === null ? 'Gestern: keine Daten' : `Gestern gesamt ${fmt.tokens(cmp.yesterday)}`),
    metric('Anfragen 24 h', count(day.totals.requests), bySource.map(s => `${CLIENTS[s.label] ?? s.label} ${count(s.requests)}`).join(' · ') || 'keine'),
    el('div', { class: 'ui-panel ui-metric' }, el('small', { text: 'Geschätzte Kosten' }), el('div', { class: 'value', text: '–' }),
      el('div', {}, stateBadge(observe({}, { now }))), el('small', { text: 'Keine belegte Preisquelle' })),
    metric('Cache-Anteil 24 h', pct(rate), rate === null ? 'Kein Input im Zeitraum' : `${fmt.tokens(day.totals.cachedInput)} Tokens aus Cache`));
}

function consumptionPanel(now) {
  const hours = rollingHours(day.byHourUtc, now);
  const obs = observe({ source: 'local-session-logs', observedAt: latest(day), value: day.totals.total }, { now, maxAgeMs: USAGE_MAX_AGE });
  return panel('Tokenverbrauch · letzte 24 h', stateBadge(obs), bars(hours, 'Tokens je Stunde, letzte 24 h (UTC)', fmt.tokens),
    hours.length ? el('div', { class: 'axis' }, el('small', { text: hours[0].label }), el('small', { text: hours[12].label }), el('small', { text: `${hours.at(-1).label} (laufend)` })) : null,
    el('small', { text: `Input + Output inkl. Cache-Lesezugriffe · gesamt ${fmt.tokens(day.totals.total)}` }));
}

function distributionPanel(data, title) {
  const rows = shares(data.byModel, 'model').slice(0, 6);
  return panel(title, el('small', { text: `${data.byModel.length} Modelle` }), rows.length ? rows.map(r => el('div', { class: 'share' },
    el('div', { class: 'between' }, el('strong', { class: 'mono', text: r.label }), el('small', { text: pct(r.share) })),
    meter(r.share, `${r.label} Anteil`),
    el('small', { text: `${fmt.tokens(r.total)} Tokens · ${count(r.requests)} Anfragen · Kosten unbekannt` }))) : el('div', { class: 'ui-empty', text: 'Keine Nutzung im Zeitraum' }));
}

function accountsPanel(now) {
  const model = trayModel(month.quotas, { now });
  const accounts = model.providers.flatMap(p => p.accounts.map(a => ({ ...a, provider: p.label })));
  const unknown = model.providers.filter(p => !p.adapter);
  return panel('Konto-Quota-Fenster', el('span', { class: 'ui-badge', text: `${accounts.length} Konto mit Daten` }),
    accounts.length ? accounts.map(a => {
      const next = a.windows.map(w => w.remainingMs).filter(v => v !== null).sort((x, y) => x - y)[0] ?? null;
      return el('div', { class: 'row' },
        el('div', { class: 'between' }, el('div', {}, el('strong', { text: a.provider }), el('small', { class: 'mono', text: ` ${a.limitId}` })),
          el('small', { text: `Plan ${a.plan ?? 'unbekannt'} · nächster Reset ${next === null ? 'unbekannt' : `in ${fmt.remaining(next)}`}` })),
        el('div', { class: 'wins' }, a.windows.map(w => el('div', { class: 'share' },
          el('div', { class: 'between' }, el('small', { text: `${w.windowMinutes ? fmt.window(w.windowMinutes) : w.name} verbraucht` }),
            el('strong', { text: w.obs.value === null ? '–' : pct(w.obs.value) })),
          meter(w.obs.value, `${a.limitId} ${w.windowMinutes ? fmt.window(w.windowMinutes) : w.name} verbraucht`),
          el('div', { class: 'between' }, el('small', { text: w.expired ? 'Zurückgesetzt' : w.resetsAt ? `Reset ${fmt.dateTime(w.resetsAt)}` : 'Reset unbekannt' }), stateBadge(w.obs))))),
        el('small', { text: `Beobachtet ${fmt.dateTime(a.observedAt)}` }));
    }) : el('div', { class: 'ui-empty', text: 'Im Zeitraum keine Quota-Beobachtung.' }),
    el('div', { class: 'row' }, el('small', { text: `Ohne Adapter (UNKNOWN): ${unknown.map(p => p.label).join(', ')}. ${unknown.find(p => p.id === 'cliproxy')?.reason ?? ''}` })));
}

function machinePanel(now) {
  const obs = observe({ source: 'local-session-logs', observedAt: latest(month), value: month.totals.total }, { now, maxAgeMs: USAGE_MAX_AGE });
  const clients = shares(month.byModel, 'source');
  const label = CLIENTS;
  return panel('Nutzung nach Maschine · 30 Tage', null,
    el('div', { class: 'row' }, el('div', { class: 'between' }, el('strong', { text: 'Diese Maschine (lokaler Server)' }), stateBadge(obs)),
      el('small', { text: `${fmt.tokens(month.totals.total)} Tokens · ${count(month.totals.requests)} Anfragen` }),
      clients.map(c => el('div', { class: 'share' }, el('div', { class: 'between' }, el('small', { text: label[c.label] ?? c.label }), el('small', { text: `${fmt.tokens(c.total)} · ${pct(c.share)}` })),
        meter(c.share, `${label[c.label] ?? c.label} Anteil`)))),
    el('div', { class: 'row' }, el('div', { class: 'between' }, el('strong', { text: 'Weitere Maschinen (Mac, andere VMs)' }), stateBadge(observe({}, { now }))),
      el('small', { text: 'Kein Adapter: Session-Logs anderer Maschinen werden nicht eingesammelt.' })));
}

function modelTable() {
  return panel('Modelle · 30 Tage', el('small', { text: `Cache-Anteil ${pct(cacheRate(month.totals))}` }), el('div', { class: 'scroll' }, table([
    { key: 'source', label: 'Quelle' }, { key: 'model', label: 'Modell' },
    { key: 'requests', label: 'Anfragen', num: true, format: count },
    { key: 'input', label: 'Input', num: true, format: fmt.tokens }, { key: 'cachedInput', label: 'Cache', num: true, format: fmt.tokens },
    { key: 'output', label: 'Output', num: true, format: fmt.tokens }, { key: 'total', label: 'Gesamt', num: true, format: fmt.tokens },
    { key: 'model', label: 'Kosten', num: true, format: () => '–' },
  ], month.byModel, 'Keine Nutzung im Zeitraum')));
}

function render(data, { now }) {
  ({ day, month } = data);
  const views = {
    all: () => [overviewMetrics(now), el('div', { class: 'split' }, consumptionPanel(now), distributionPanel(day, 'Modellverteilung · 24 h')), accountsPanel(now), machinePanel(now)],
    account: () => [accountsPanel(now)],
    model: () => [el('div', { class: 'split' }, distributionPanel(month, 'Modellverteilung · 30 Tage'), distributionPanel(day, 'Modellverteilung · 24 h')), modelTable()],
    machine: () => [machinePanel(now)],
  };
  return el('div', { style: 'display:grid;gap:12px' }, views[view]());
}

mountPage({
  // sequential: the server runs one collection at a time
  fetchData: async () => ({ day: await getJson('/api/usage?days=1'), month: await getJson('/api/usage?days=30') }),
  render,
  exportFile: d => ({ name: `cliproxyapi-usage-${d.month.generatedAt.slice(0, 10)}.json`, data: { last24h: d.day, last30d: d.month } }),
  onView: v => { view = v; },
  poll: 'Abfrage alle 5 min', pollMs: 5 * 60e3, tickMs: 30e3,
});
