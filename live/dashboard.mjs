// SERVAS-2071 functional OpenCodex usage surface. Data: GET /api/usage
// (app/server.mjs). Quota values are shown only with source + timestamp.
import { observe } from '../shared/state.mjs';
import { el, icon, stateBadge, panel, metric, meter, table, bars, fmt } from '../shared/components.mjs';

const QUOTA_MAX_AGE = 6 * 3600e3;   // Codex refreshes rate_limits per turn; older = stale
const USAGE_MAX_AGE = 24 * 3600e3;
const $ = id => document.getElementById(id);
const root = document.documentElement;

function quotaWindow(q, w, now) {
  // A window whose reset already passed no longer describes current usage.
  const expired = w.resetsAt && Date.parse(w.resetsAt) <= now;
  const obs = observe({ source: `${q.source}:${q.limitId}`, observedAt: q.observedAt,
    value: expired ? null : w.usedPercent }, { now, maxAgeMs: QUOTA_MAX_AGE });
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

function render(data) {
  const now = Date.now();
  const usageObs = observe({ source: 'local-session-logs', observedAt: data.sources.map(s => s.observedAt).filter(Boolean).sort().at(-1), value: data.totals.total }, { now, maxAgeMs: USAGE_MAX_AGE });
  const t = data.totals;
  const cacheShare = t.total ? `${((t.cachedInput / t.total) * 100).toLocaleString('de-AT', { maximumFractionDigits: 1 })} % aus Cache` : null;
  const hours = data.byHourUtc.map((value, h) => ({ label: `${String(h).padStart(2, '0')} UTC`, value }));
  $('app').replaceChildren(el('div', { style: 'display:grid;gap:16px' },
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
    ], data.sources))));
}

function renderError(message) {
  const obs = observe({ error: true }, {});
  $('app').replaceChildren(panel('Daten nicht verfügbar', stateBadge(obs), el('div', { class: 'ui-empty', text: message })));
}

let pending = null;
async function load() {
  if (pending) return pending;
  const btn = $('refresh');
  btn.disabled = true; $('app').setAttribute('aria-busy', 'true');
  btn.replaceChildren(icon('loader-circle'), 'Lädt …');
  pending = (async () => {
    try {
      const res = await fetch(`/api/usage?days=${encodeURIComponent($('range').value)}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      render(await res.json());
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
$('theme').addEventListener('click', () => applyTheme(root.dataset.theme === 'dark' ? 'light' : 'dark'));
$('refresh').addEventListener('click', load);
$('range').addEventListener('change', load);
load();
