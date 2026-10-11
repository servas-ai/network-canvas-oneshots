// SERVAS-2071 functional OpenCodex usage surface. Data: GET /api/usage
// (app/server.mjs). Quota values are shown only with source + timestamp.
import { observe } from '../shared/state.mjs';
import { quotaWindow as windowView } from '../shared/quota.mjs';
import { el, stateBadge, panel, metric, meter, table, bars, fmt } from '../shared/components.mjs';
import { mountPage, getJson } from '../shared/page.mjs';

const USAGE_MAX_AGE = 24 * 3600e3;

function quotaWindow(q, w, now) {
  const { obs, expired } = windowView(q, w, { now });
  const name = w.windowMinutes ? `Fenster ${fmt.window(w.windowMinutes)}` : w.name;
  return el('div', { class: 'quota-row' },
    el('div', { class: 'between' }, el('strong', { text: name }), stateBadge(obs)),
    meter(obs.value, `${q.limitId} ${name} verbraucht`),
    el('div', { class: 'between' },
      el('small', { text: obs.value === null ? (expired ? 'Fenster zurückgesetzt – neuer Stand erst nach nächster Codex-Anfrage' : 'Kein belegter Wert') : `${obs.value.toLocaleString('de-AT', { maximumFractionDigits: 0 })} % verbraucht` }),
      el('small', { text: w.resetsAt ? `Reset ${fmt.dateTime(w.resetsAt)}` : 'Reset unbekannt' })));
}

function quotaPanel(data, now) {
  if (!data.quotas.length) {
    const obs = observe({}, { now });
    return panel('Konto-Quota', stateBadge(obs), el('div', { class: 'ui-empty', text: 'Im Zeitraum keine Codex-Ratelimit-Beobachtung. Claude-Code-Logs enthalten keine Quota.' }));
  }
  return panel('Konto-Quota', null, el('div', { class: 'quota' }, data.quotas.map(q => el('div', {},
    el('div', { class: 'between' }, el('span', { class: 'mono', text: q.limitId }), el('small', { text: `Plan ${q.plan ?? 'unbekannt'} · beobachtet ${fmt.dateTime(q.observedAt)}` })),
    q.windows.length ? q.windows.map(w => quotaWindow(q, w, now)) : el('div', { class: 'ui-empty', text: 'Keine Fenster gemeldet' })))),
  el('small', { text: 'Nur das Konto der lokalen Codex-Installation. Weitere Pool-Konten: kein Adapter (UNKNOWN).' }));
}

function render(data, { now }) {
  const usageObs = observe({ source: 'local-session-logs', observedAt: data.sources.map(s => s.observedAt).filter(Boolean).sort().at(-1), value: data.totals.total }, { now, maxAgeMs: USAGE_MAX_AGE });
  const t = data.totals;
  const cacheShare = t.total ? `${((t.cachedInput / t.total) * 100).toLocaleString('de-AT', { maximumFractionDigits: 1 })} % aus Cache` : null;
  const hours = data.byHourUtc.map((value, h) => ({ label: `${String(h).padStart(2, '0')} UTC`, value }));
  return el('div', { style: 'display:grid;gap:16px' },
    el('div', { class: 'grid4' },
      metric('Tokens gesamt', fmt.tokens(t.total), cacheShare),
      metric('Anfragen', t.requests.toLocaleString('de-AT'), data.windowDays === 1 ? '24 h' : `${data.windowDays} Tage`),
      metric('Output', fmt.tokens(t.output), `davon Reasoning ${fmt.tokens(t.reasoning)}`),
      metric('Input (ohne Cache)', fmt.tokens(t.input), null)),
    el('div', { class: 'grid2' },
      panel('Tokens pro Tag', stateBadge(usageObs), bars(data.byDay.map(d => ({ label: d.day, value: d.total })), 'Tokens pro Tag', fmt.tokens),
        data.byDay.length ? el('div', { class: 'axis' }, el('small', { text: data.byDay[0].day }), el('small', { text: data.byDay.at(-1).day })) : null),
      quotaPanel(data, now)),
    el('div', { class: 'grid2' },
      panel('Modelle', null, table([
        { key: 'source', label: 'Quelle' }, { key: 'model', label: 'Modell' },
        { key: 'requests', label: 'Anfragen', num: true, format: v => v.toLocaleString('de-AT') },
        { key: 'input', label: 'Input', num: true, format: fmt.tokens }, { key: 'cachedInput', label: 'Cache', num: true, format: fmt.tokens },
        { key: 'output', label: 'Output', num: true, format: fmt.tokens }, { key: 'total', label: 'Gesamt', num: true, format: fmt.tokens },
      ], data.byModel, 'Keine Nutzung im Zeitraum')),
      panel('Aktivität nach Stunde', el('small', { text: 'UTC' }), bars(hours, 'Tokens nach Stunde (UTC)', fmt.tokens),
        el('div', { class: 'axis' }, el('small', { text: '00' }), el('small', { text: '12' }), el('small', { text: '23' })))),
    panel('Quellen', el('small', { text: `erzeugt ${fmt.dateTime(data.generatedAt)}` }), table([
      { key: 'id', label: 'Quelle' }, { key: 'files', label: 'Dateien', num: true }, { key: 'records', label: 'Datensätze', num: true },
      { key: 'observedAt', label: 'Letzte Beobachtung', format: v => (v ? fmt.dateTime(v) : 'keine') },
    ], data.sources)));
}

const range = document.getElementById('range');
const page = mountPage({ fetchData: () => getJson(`/api/usage?days=${encodeURIComponent(range.value)}`), render });
range.addEventListener('change', page.reload);
