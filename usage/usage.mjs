// SERVAS-2071 functional CLIProxyAPI Usage (replaces the cliproxyapi-usage.html
// mockup data). Data: GET /api/usage (app/server.mjs) for 24 h and 30 days;
// analytics from shared/usage.mjs, quota windows from shared/quota.mjs.
// Spend, CLIProxy pool accounts and other machines have no adapter: UNKNOWN.
import { observe } from '../shared/state.mjs';
import { trayModel } from '../shared/quota.mjs';
import { cacheRate, dayCompare, rollingHours, shares } from '../shared/usage.mjs';
import { el, icon, stateBadge, panel, metric, meter, table, bars, fmt } from '../shared/components.mjs';

const POLL_MS = 5 * 60e3;
const USAGE_MAX_AGE = 24 * 3600e3;
const $ = id => document.getElementById(id);
const root = document.documentElement;
let day = null, month = null, loadedAt = null, view = 'all';

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

function render() {
  if (!day || !month) return;
  const now = Date.now();
  const views = {
    all: () => [overviewMetrics(now), el('div', { class: 'split' }, consumptionPanel(now), distributionPanel(day, 'Modellverteilung · 24 h')), accountsPanel(now), machinePanel(now)],
    account: () => [accountsPanel(now)],
    model: () => [el('div', { class: 'split' }, distributionPanel(month, 'Modellverteilung · 30 Tage'), distributionPanel(day, 'Modellverteilung · 24 h')), modelTable()],
    machine: () => [machinePanel(now)],
  };
  $('app').replaceChildren(el('div', { style: 'display:grid;gap:12px' }, views[view]()));
  $('poll').textContent = `127.0.0.1 · Abfrage alle 5 min · zuletzt ${loadedAt ? `vor ${fmt.remaining(now - loadedAt)}` : '–'} · echte lokale Daten`;
}

function renderError(message) {
  $('app').replaceChildren(panel('Daten nicht verfügbar', stateBadge(observe({ error: true }, {})), el('div', { class: 'ui-empty', text: message })));
}

async function get(days) {
  const res = await fetch(`/api/usage?days=${days}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

let pending = null;
function load() {
  if (pending) return pending;
  const btn = $('refresh');
  btn.disabled = true; $('app').setAttribute('aria-busy', 'true');
  btn.replaceChildren(icon('loader-circle'), 'Lädt …');
  pending = (async () => {
    try {
      day = await get(1); month = await get(30); loadedAt = Date.now(); // sequential: server collects one at a time
      render();
      $('export').disabled = false;
      $('live').textContent = `Aktualisiert ${new Date().toLocaleTimeString('de-AT')}`;
    } catch (err) {
      renderError(`Abruf von /api/usage fehlgeschlagen (${err.message}). Läuft app/server.mjs?`);
      $('live').textContent = 'Aktualisierung fehlgeschlagen';
    } finally {
      btn.disabled = false; $('app').setAttribute('aria-busy', 'false');
      btn.replaceChildren(icon('refresh-cw'), 'Neu laden');
      pending = null;
    }
  })();
  return pending;
}

function exportJson() {
  if (!month) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify({ last24h: day, last30d: month }, null, 2)], { type: 'application/json' }));
  el('a', { href: url, download: `cliproxyapi-usage-${month.generatedAt.slice(0, 10)}.json` }).click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function select(tab, focus = false) {
  for (const t of tabs) { const on = t === tab; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; }
  view = tab.dataset.view;
  $('app').setAttribute('aria-labelledby', tab.id);
  if (focus) tab.focus();
  render();
}

function applyTheme(theme) {
  root.dataset.theme = theme;
  $('theme').textContent = theme === 'dark' ? 'Hell' : 'Dunkel';
  try { localStorage.setItem('oneshots.theme', theme); } catch {}
}

const tabs = [...document.querySelectorAll('[role=tab]')];
for (const t of tabs) {
  t.addEventListener('click', () => select(t));
  t.addEventListener('keydown', e => {
    const i = tabs.indexOf(t);
    const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    select(tabs[(next + tabs.length) % tabs.length], true);
  });
}
applyTheme((() => { try { return localStorage.getItem('oneshots.theme'); } catch { return null; } })() ?? 'dark');
$('export').replaceChildren(icon('download'), 'JSON');
$('theme').addEventListener('click', () => applyTheme(root.dataset.theme === 'dark' ? 'light' : 'dark'));
$('refresh').addEventListener('click', load);
$('export').addEventListener('click', exportJson);
document.addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey || e.target.closest('input, select, textarea')) return;
  if (e.key === 'r') load();
  else if (e.key === 'e') exportJson();
  else if (e.key === 't') applyTheme(root.dataset.theme === 'dark' ? 'light' : 'dark');
});
setInterval(() => { if (!document.hidden) load(); }, POLL_MS);
setInterval(render, 30e3);
load();
