// SERVAS-2071 functional Tokscale surface (replaces the tokscale.html mockup
// data with real local usage). Data: GET /api/usage?days=365 (app/server.mjs);
// layout, grid and state logic come from shared/.
import { observe } from '../shared/state.mjs';
import { calendarWeeks, levelScale, dayStats, monthMarks } from '../shared/calendar.mjs';
import { el, icon, stateBadge, panel, metric, table, bars, heatmap, legend, fmt } from '../shared/components.mjs';

const USAGE_MAX_AGE = 24 * 3600e3;
const $ = id => document.getElementById(id);
const root = document.documentElement;
const pct = v => `${v.toLocaleString('de-AT', { maximumFractionDigits: 1 })} %`;
const SOURCE = { codex: 'Codex', claude: 'Claude Code' };
let current = null;

function render(data) {
  const now = Date.now();
  const st = dayStats(data.byDay);
  const weeks = calendarWeeks(data.byDay);
  const usageObs = observe({ source: 'local-session-logs', observedAt: data.sources.map(s => s.observedAt).filter(Boolean).sort().at(-1), value: data.totals.total }, { now, maxAgeMs: USAGE_MAX_AGE });
  const t = data.totals;
  const today = data.byDay.at(-1);
  $('subtitle').textContent = `${st.days} Tage · ${data.sources.filter(s => s.records).length} Quellen · ${data.sources.reduce((s, x) => s + x.files, 0).toLocaleString('de-AT')} Session-Dateien`;
  const costObs = observe({}, { now });
  $('app').replaceChildren(el('div', { style: 'display:grid;gap:16px' },
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
        el('small', { text: today ? `Heute (${fmt.day(today.day)}): ${fmt.tokens(today.total)} Tokens` : '' })))));
  // Narrow viewports scroll the grid; start at the newest week, not a year ago.
  const scroller = $('app').querySelector('.ui-heatmap');
  if (scroller) scroller.scrollLeft = scroller.scrollWidth;
}

function renderError(message) {
  $('app').replaceChildren(panel('Daten nicht verfügbar', stateBadge(observe({ error: true }, {})), el('div', { class: 'ui-empty', text: message })));
}

function exportJson() {
  if (!current) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify(current, null, 2)], { type: 'application/json' }));
  el('a', { href: url, download: `tokscale-${current.generatedAt.slice(0, 10)}.json` }).click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

let pending = null;
async function load() {
  if (pending) return pending;
  const btn = $('refresh');
  btn.disabled = true; $('app').setAttribute('aria-busy', 'true');
  btn.replaceChildren(icon('loader-circle'), 'Lädt …');
  pending = (async () => {
    try {
      const res = await fetch('/api/usage?days=365', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      current = await res.json();
      render(current);
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

function applyTheme(theme) {
  root.dataset.theme = theme;
  $('theme').textContent = theme === 'dark' ? 'Hell' : 'Dunkel';
  try { localStorage.setItem('oneshots.theme', theme); } catch {}
}

applyTheme((() => { try { return localStorage.getItem('oneshots.theme'); } catch { return null; } })() ?? 'dark');
$('export').replaceChildren(icon('download'), 'JSON');
$('theme').addEventListener('click', () => applyTheme(root.dataset.theme === 'dark' ? 'light' : 'dark'));
$('refresh').addEventListener('click', load);
$('export').addEventListener('click', exportJson);
document.addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey || e.target.closest('input, select, textarea')) return;
  if (e.key === 'r') load();
  else if (e.key === 'e') exportJson();
  else if (e.key === 't') $('theme').click();
});
load();
