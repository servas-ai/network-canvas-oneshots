import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// SERVAS-2071: WCAG 2.x AA for small text; badges, table heads and <small> are 11px.
// Light state colours follow radar web/cards/shared/tool-ui-tokens.css (PR541).
const AA = 4.5;
const css = readFileSync(new URL('../shared/tokens.css', import.meta.url), 'utf8');

function block(src, selector) {
  const at = src.indexOf(`${selector} {`);
  assert.notEqual(at, -1, `missing ${selector}`);
  const body = src.slice(at, src.indexOf('}', at));
  return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*#([0-9a-f]{6}|[0-9a-f]{3})\b/gi)]
    .map(([, name, h]) => [name, '#' + (h.length === 3 ? [...h].map(c => c + c).join('') : h).toLowerCase()]));
}
const themes = src => {
  const light = block(src, ':root');
  return { light, dark: { ...light, ...block(src, ':root[data-theme="dark"]') } };
};

const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const hex = c => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
const mix = (a, b, p) => hex(rgb(a).map((v, i) => v * p + rgb(b)[i] * (1 - p)));
const lum = h => rgb(h).map(v => (v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
  .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
export const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

// Text/background pairs exactly as tokens.css paints them.
export function pairs(t) {
  return {
    'muted on panel (table head, small, empty)': [t.muted, t.panel],
    'muted on bg (nav, statusbar)': [t.muted, t.bg],
    'unknown/loading badge on soft': [t.muted, t.soft],
    'ready badge on green 14% over panel': [t.green, mix(t.green, t.panel, 0.14)],
    'stale badge on amber-bg': [t.amber, t['amber-bg']],
    'stale text on panel': [t.amber, t.panel],
    'error badge on red-bg': [t.red, t['red-bg']],
    'error text on panel': [t.red, t.panel],
  };
}
const failures = src => Object.entries(themes(src)).flatMap(([theme, t]) =>
  Object.entries(pairs(t)).filter(([, [fg, bg]]) => contrast(fg, bg) < AA)
    .map(([name, [fg, bg]]) => `${theme} ${name} ${fg}/${bg} ${contrast(fg, bg).toFixed(2)}`));

test('contrast math matches WCAG reference points', () => {
  assert.equal(contrast('#000000', '#ffffff').toFixed(2), '21.00');
  assert.equal(contrast('#767676', '#ffffff').toFixed(2), '4.54');
});

test('every small state label reaches AA 4.5 in light and dark', () => {
  assert.deepEqual(failures(css), []);
});

test('negative probe: the previous light state colours fail', () => {
  const old = css.replace(/(:root \{[^}]*)--muted: #[0-9a-f]{6}/i, '$1--muted: #737b8d')
    .replace(/(:root \{[^}]*)--amber: #[0-9a-f]{6}/i, '$1--amber: #a86200')
    .replace(/(:root \{[^}]*)--red: #[0-9a-f]{6}/i, '$1--red: #d6505b')
    .replace(/(:root \{[^}]*)--green: #[0-9a-f]{6}/i, '$1--green: #138661');
  const f = failures(old);
  for (const name of ['light muted on panel', 'light unknown/loading badge', 'light ready badge', 'light stale badge', 'light error badge', 'light error text'])
    assert.ok(f.some(x => x.startsWith(name)), `${name} should fail with old colours; got ${f.join('; ')}`);
  assert.ok(f.every(x => x.startsWith('light ')), 'dark theme was already AA');
});

// button.primary: --on-accent on --accent, 13px text, per product and theme
// (cpa-manager-plus keeps the default accent).
const PRODUCTS = ['cpa-manager-plus', 'opencodex', 'tokscale', 'quota-tray', 'cliproxyapi-usage', 'claude-code-router'];
const optional = (src, selector) => (src.includes(`${selector} {`) ? block(src, selector) : {});
function primaryFailures(src) {
  const base = themes(src);
  return PRODUCTS.flatMap(p => Object.entries(base).flatMap(([theme, t]) => {
    const light = { ...t, ...optional(src, `:root[data-product="${p}"]`) };
    const c = theme === 'dark' ? { ...light, ...optional(src, `:root[data-product="${p}"][data-theme="dark"]`) } : light;
    const fg = c['on-accent'] ?? '#0b1420'; // before --on-accent the text was fixed #0b1420
    const ratio = contrast(fg, c.accent);
    return ratio < AA ? [`${p} ${theme} ${fg}/${c.accent} ${ratio.toFixed(2)}`] : [];
  }));
}

test('primary button text reaches AA 4.5 for every product in light and dark', () => {
  assert.deepEqual(primaryFailures(css), []);
});

test('negative probe: the previous fixed #0b1420 primary text fails default, quota tray light and router light', () => {
  const old = css.replace(/--on-accent: #[0-9a-f]{3,6}/gi, '--on-accent: #0b1420');
  assert.deepEqual(primaryFailures(old).map(f => f.split(' ').slice(0, 2).join(' ')).sort(),
    ['claude-code-router light', 'cpa-manager-plus dark', 'cpa-manager-plus light', 'quota-tray light']);
});
