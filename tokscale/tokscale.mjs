// SERVAS-2071 functional Tokscale surface (replaces the tokscale.html mockup
// data with real local usage). Data: GET /api/usage?days=365 (app/server.mjs);
// layout, grid and state logic come from shared/.
import { observe } from '../shared/state.mjs';
import { calendarWeeks, levelScale, dayStats, monthMarks } from '../shared/calendar.mjs';
import { el, stateBadge, panel, metric, table, bars, heatmap, legend, fmt } from '../shared/components.mjs';
import { mountPage, getJson } from '../shared/page.mjs';

const USAGE_MAX_AGE = 24 * 3600e3;
const pct = v => `${v.toLocaleString('de-AT', { maximumFractionDigits: 1 })} %`;
const SOURCE = { codex: 'Codex', claude: 'Claude Code' };

function render(data, { now }) {
  const st = dayStats(data.byDay);
  const weeks = calendarWeeks(data.byDay);
  const usageObs = observe({ source: 'local-session-logs', observedAt: data.sources.map(s => s.observedAt).filter(Boolean).sort().at(-1), value: data.totals.total }, { now, maxAgeMs: USAGE_MAX_AGE });
  const t = data.totals;
  const today = data.byDay.at(-1);
  document.getElementById('subtitle').textContent = `${st.days} Tage · ${data.sources.filter(s => s.records).length} Quellen · ${data.sources.reduce((s, x) => s + x.files, 0).toLocaleString('de-AT')} Session-Dateien`;
  const costObs = observe({}, { now });
  return el('div', { style: 'display:grid;gap:16px' },
    el('div', { class: 'grid4' },
      metric('Tokens gesamt', fmt.tokens(t.total), t.total ? `${pct((t.cachedInput / t.total) * 100)} aus Cache` : null),
      el('div', { class: 'ui-panel ui-metric' }, el('small', { text: 'Geschätzte Kosten' }),
        el('div', { class: 'value', text: '–' }), stateBadge(costObs, 'keine Preisquelle')),
      metric('Aktive Tage', `${st.activeDays} / ${st.days}`, `Aktuelle Serie ${st.currentStreak} · längste ${st.longestStreak} Tage`),
      metric('Ø pro aktivem Tag', fmt.tokens(st.avgPerActiveDay), st.peak ? `Spitze ${fmt.tokens(st.peak.total)} am ${fmt.day(st.peak.day)}` : null)),
    panel(`Token-Aktivität · ${st.days} Tage`, stateBadge(usageObs),
      heatmap(weeks, monthMarks(weeks), levelScale(data.byDay), 'Tokens pro Tag als Jahresraster', fmt.tokens),
      el('div', { class: 'between' }, el('small', { text: `${st.activeDays} Tage mit KI gebaut · ${weeks.length} Wochen` }), legend())),
    el('div', { class: 'grid2' },
      panel('Modelle', null, table([
        { key: 'model', label: 'Modell' }, { key: 'source', label: 'Quelle', format: v => SOURCE[v] ?? v },
        { key: 'requests', label: 'Anfragen', num: true, format: v => v.toLocaleString('de-AT') },
        { key: 'total', label: 'Tokens', num: true, format: fmt.tokens },
        { key: 'total', label: 'Anteil', num: true, format: v => (t.total ? pct((v / t.total) * 100) : '–') },
      ], data.byModel, 'Keine Nutzung im Zeitraum')),
      panel('Aktivität nach Stunde', el('small', { text: 'UTC, ganzer Zeitraum' }),
        bars(data.byHourUtc.map((value, h) => ({ label: `${String(h).padStart(2, '0')} UTC`, value })), 'Tokens nach Stunde (UTC)', fmt.tokens),
        el('div', { class: 'axis' }, el('small', { text: '00' }), el('small', { text: '12' }), el('small', { text: '23' })),
        el('small', { text: today ? `Heute (${fmt.day(today.day)}): ${fmt.tokens(today.total)} Tokens` : '' }))));
}

mountPage({
  fetchData: () => getJson('/api/usage?days=365'),
  render: (data, ctx) => {
    // Narrow viewports scroll the grid; start at the newest week, not a year
    // ago. Runs once the node is in #app and has a width.
    queueMicrotask(() => { const g = document.querySelector('#app .ui-heatmap'); if (g) g.scrollLeft = g.scrollWidth; });
    return render(data, ctx);
  },
  exportFile: d => ({ name: `tokscale-${d.generatedAt.slice(0, 10)}.json`, data: d }),
});
