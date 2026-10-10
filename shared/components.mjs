// SERVAS-2071 shared DOM components. All text goes through textContent;
// icons are decorative (aria-hidden). Styling lives in shared/tokens.css.
const SVG = 'http://www.w3.org/2000/svg';
const PATHS = Object.freeze({
  'circle-check': 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9 12l2 2 4-4',
  'circle-help': 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
  'loader-circle': 'M21 12a9 9 0 1 1-6.2-8.6',
  'triangle-alert': 'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01',
  download: 'M12 3v12M7 10l5 5 5-5M5 21h14',
  flame: 'M12 22a7 7 0 0 0 7-7c0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-4-3 2-5 5-5 8a7 7 0 0 0 7 7z',
  'refresh-cw': 'M21 12a9 9 0 0 1-15 6.7L3 16M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M3 21v-5h5',
});

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === false || value === null || value === undefined) continue;
    if (key === 'text') node.textContent = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? '' : value);
  }
  node.append(...children.flat().filter(c => c !== null && c !== undefined));
  return node;
}

export function icon(name) {
  const svg = document.createElementNS(SVG, 'svg');
  for (const [k, v] of Object.entries({ viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
    'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' })) svg.setAttribute(k, v);
  const path = document.createElementNS(SVG, 'path');
  path.setAttribute('d', PATHS[name] ?? PATHS['circle-help']);
  svg.append(path);
  return svg;
}

// obs is the frozen result of shared/state.mjs observe().
export function stateBadge(obs, prefix = '') {
  return el('span', { class: 'ui-badge', role: 'status', dataset: { state: obs.state },
    title: obs.source ? `Quelle: ${obs.source}${obs.observedAt ? ` · ${obs.observedAt}` : ''}` : 'Keine belegte Quelle' },
  icon(obs.icon), prefix ? `${prefix} · ${obs.label}` : obs.label);
}

export function panel(title, aside, ...body) {
  return el('section', { class: 'ui-panel' }, el('header', {}, el('h2', { text: title }), aside), ...body);
}

export function metric(label, value, hint) {
  return el('div', { class: 'ui-panel ui-metric' }, el('small', { text: label }),
    el('div', { class: 'value', text: value }), hint ? el('small', { text: hint }) : null);
}

// percent: 0..100 or null (unknown -> hatched, no fake value).
export function meter(percent, label) {
  const known = Number.isFinite(percent);
  const clamped = known ? Math.max(0, Math.min(100, percent)) : 0;
  const level = !known ? null : clamped >= 90 ? 'bad' : clamped >= 70 ? 'warn' : 'ok';
  return el('div', { class: 'ui-meter', role: 'meter', 'aria-label': label,
    'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': known ? String(clamped) : null,
    'aria-valuetext': known ? `${clamped.toFixed(0)} %` : 'Unbekannt',
    dataset: known ? { level } : { state: 'unknown' } }, el('span', { style: `width:${clamped}%` }));
}

export function table(columns, rows, empty = 'Keine Daten') {
  if (!rows.length) return el('div', { class: 'ui-empty', text: empty });
  return el('table', { class: 'ui-table' },
    el('thead', {}, el('tr', {}, columns.map(c => el('th', { class: c.num ? 'num' : null, scope: 'col', text: c.label })))),
    el('tbody', {}, rows.map(r => el('tr', {}, columns.map(c => el('td', { class: c.num ? 'num' : null, text: c.format ? c.format(r[c.key], r) : String(r[c.key] ?? '–') }))))));
}

export function bars(points, label, format = String) {
  if (!points.length) return el('div', { class: 'ui-empty', text: 'Keine Daten' });
  const max = Math.max(1, ...points.map(p => p.value));
  return el('div', {}, el('div', { class: 'ui-bars', role: 'img', 'aria-label': label },
    points.map(p => el('span', { style: `height:${Math.max(2, (p.value / max) * 100)}%`, title: `${p.label}: ${format(p.value)}` }))),
  el('p', { class: 'sr-only', text: points.map(p => `${p.label} ${format(p.value)}`).join(', ') }));
}

// GitHub-style year grid. weeks: shared/calendar.mjs calendarWeeks(); level: total -> 0..4.
// Keyboard: the grid is one tab stop; the per-day list is available to screen readers.
export function heatmap(weeks, marks, level, label, format = String) {
  if (!weeks.length) return el('div', { class: 'ui-empty', text: 'Keine Daten' });
  const months = new Intl.DateTimeFormat('de-AT', { month: 'short', timeZone: 'UTC' });
  return el('div', { class: 'ui-heatmap', style: `--weeks:${weeks.length}` },
    el('div', { class: 'ui-heatmap-months', 'aria-hidden': 'true' }, marks.map(m =>
      el('small', { style: `grid-column:${m.week + 1}`, text: months.format(new Date(`${m.month}-01T00:00:00Z`)) }))),
    el('div', { class: 'ui-heatmap-grid', role: 'img', 'aria-label': label, tabindex: '0' },
      weeks.flatMap(week => week.map(c => el('span', c
        ? { dataset: { level: String(level(c.total)) }, title: `${c.day}: ${format(c.total)}` }
        : { class: 'pad' })))),
    el('p', { class: 'sr-only', text: weeks.flat().filter(c => c && c.total > 0).map(c => `${c.day} ${format(c.total)}`).join(', ') || 'Keine aktiven Tage' }));
}

export function legend(less = 'Weniger', more = 'Mehr') {
  return el('div', { class: 'ui-legend', 'aria-hidden': 'true' }, el('small', { text: less }),
    [0, 1, 2, 3, 4].map(l => el('span', { dataset: { level: String(l) } })), el('small', { text: more }));
}

export const fmt = Object.freeze({
  tokens(n) {
    if (!Number.isFinite(n)) return '–';
    for (const [d, s] of [[1e9, ' Mrd.'], [1e6, ' Mio.'], [1e3, ' Tsd.']]) if (Math.abs(n) >= d) return `${(n / d).toLocaleString('de-AT', { maximumFractionDigits: 1 })}${s}`;
    return n.toLocaleString('de-AT');
  },
  day(iso) {
    const t = Date.parse(`${iso}T00:00:00Z`);
    return Number.isFinite(t) ? new Date(t).toLocaleDateString('de-AT', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '–';
  },
  dateTime(iso) {
    const t = Date.parse(iso);
    return Number.isFinite(t) ? new Date(t).toLocaleString('de-AT', { dateStyle: 'short', timeStyle: 'short' }) : '–';
  },
  window(minutes) {
    if (!Number.isFinite(minutes)) return '–';
    return minutes % 1440 === 0 ? `${minutes / 1440} Tage` : minutes % 60 === 0 ? `${minutes / 60} h` : `${minutes} min`;
  },
});
