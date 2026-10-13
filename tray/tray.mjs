// SERVAS-2071 functional CLIProxy Quota Tray (replaces the cliproxy-quota-tray.html
// mockup data). Data: GET /api/usage (app/server.mjs); window/provider logic from
// shared/quota.mjs. Providers without an adapter stay UNKNOWN, costs too.
import { observe } from '../shared/state.mjs';
import { trayModel } from '../shared/quota.mjs';
import { el, icon, stateBadge, panel, meter, fmt } from '../shared/components.mjs';
import { mountPage, getJson } from '../shared/page.mjs';

const GROUPS = { all: null, codex: ['codex'], claude: ['claude'], other: ['gemini', 'grok', 'cliproxy'] };
const $ = id => document.getElementById(id);
let filter = 'all';

const pct = v => `${v.toLocaleString('de-AT', { maximumFractionDigits: 0 })} %`;
const sumDays = (byDay, n) => byDay.slice(-n).reduce((s, d) => s + d.total, 0);

function windowView(w, limitId) {
  const name = w.windowMinutes ? fmt.window(w.windowMinutes) : (w.name ?? 'Fenster');
  const note = w.expired ? 'Zurückgesetzt – neuer Stand nach nächster Anfrage'
    : w.remainingMs !== null ? `Reset in ${fmt.remaining(w.remainingMs)}` : 'Reset unbekannt';
  return el('div', { class: 'win' },
    el('div', { class: 'between' }, el('span', { text: `${name} verbraucht` }),
      el('strong', { text: w.obs.value === null ? '–' : pct(w.obs.value) })),
    meter(w.obs.value, `${limitId} ${name} verbraucht`),
    el('div', { class: 'between' }, el('small', { text: note }), stateBadge(w.obs)));
}

function providerPanel(p) {
  const head = el('span', { class: 'tag', text: p.adapter ? `${p.accounts.length} Konto` : 'kein Adapter' });
  if (!p.accounts.length) {
    return panel(p.label, head, el('div', { class: 'ui-empty' }, stateBadge(observe({}, {})), ' ',
      p.reason ?? 'Im Zeitraum keine Beobachtung.'));
  }
  return panel(p.label, head, p.accounts.map(a => el('article', { class: 'account' },
    el('div', { class: 'between' }, el('strong', { class: 'mono', text: a.limitId }),
      el('span', { class: 'tag', text: a.plan ?? 'Plan unbekannt' })),
    a.windows.length ? el('div', { class: 'windows' }, a.windows.map(w => windowView(w, a.limitId)))
      : el('div', { class: 'ui-empty', text: 'Keine Fenster gemeldet' }),
    a.limitReached ? el('div', { class: 'ui-empty', dataset: { state: 'error' }, text: `Limit erreicht: ${a.limitReached}` }) : null,
    el('small', { text: `Beobachtet ${fmt.dateTime(a.observedAt)} · Quelle lokale Codex-Session-Logs` }))));
}

function usagePanel(data, now) {
  const obs = observe({ source: 'local-session-logs', observedAt: data.sources.map(s => s.observedAt).filter(Boolean).sort().at(-1), value: data.totals.total }, { now, maxAgeMs: 24 * 3600e3 });
  const cell = (label, value) => el('div', {}, el('small', { text: label }), el('strong', { text: value }));
  return panel('Verbrauch', stateBadge(obs), el('div', { class: 'costgrid' },
    cell('TOKENS HEUTE', fmt.tokens(sumDays(data.byDay, 1))), cell('TOKENS 7 TAGE', fmt.tokens(sumDays(data.byDay, 7))),
    cell('TOKENS 30 TAGE', fmt.tokens(sumDays(data.byDay, 30))), cell('ANFRAGEN 30 T', data.totals.requests.toLocaleString('de-AT')),
    cell('KOSTEN HEUTE', '–'), cell('KOSTEN 7 TAGE', '–'), cell('KOSTEN 30 TAGE', '–'), cell('QUEUE', '–')),
  el('div', { class: 'between', style: 'margin-top:12px' }, el('small', { text: 'Kosten und CLIProxy-Queue: keine belegte Quelle' }), stateBadge(observe({}, { now }), 'Kosten')));
}

function sourcesPanel(model) {
  return panel('Datenquellen', el('small', { text: `${model.covered} von ${model.total} mit Daten` }),
    model.providers.map(p => el('div', { class: 'src' },
      el('div', { class: 'between' }, el('span', { text: p.label }),
        el('span', { class: 'ui-badge', dataset: { state: p.state }, role: 'status' }, icon(p.state === 'ready' ? 'circle-check' : p.state === 'stale' ? 'clock' : 'circle-help'),
          p.worst === null ? (p.state === 'unknown' ? 'Unbekannt' : '–') : `max ${pct(p.worst)}`)),
      el('small', { text: p.adapter ? `Adapter: ${p.adapter}` : p.reason }))));
}

function render(current, { now }) {
  const model = trayModel(current.quotas, { now });
  const ids = GROUPS[filter];
  // Overview: only providers with data; unknown ones are listed under Datenquellen.
  const shown = model.providers.filter(p => (ids ? ids.includes(p.id) : p.accounts.length > 0));
  const stale = model.worst !== null && !model.providers.some(p => p.state === 'ready');
  $('subtitle').textContent = model.worst === null ? 'Keine Quota belegt'
    : `Höchste Auslastung ${pct(model.worst)}${stale ? ' (veraltet)' : ''} · ${model.covered} von ${model.total} Quellen mit Daten`;
  return el('div', { style: 'display:grid;gap:12px' },
    filter === 'all' ? el('div', { class: 'grid2' }, usagePanel(current, now), sourcesPanel(model)) : null,
    el('div', { class: 'grid2' }, shown.map(providerPanel)));
}

mountPage({
  fetchData: () => getJson('/api/usage?days=30'),
  render,
  onView: v => { filter = v; },
  poll: 'Abfrage alle 20 min', pollMs: 20 * 60e3, // mockup: "Poll every 20 minutes"
  tickMs: 30e3, // countdowns re-render without refetch
});
