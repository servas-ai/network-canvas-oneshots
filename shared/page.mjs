// SERVAS-2071 shared page shell for every functional surface (live, tokscale,
// tray, usage, opencodex, cpa): one fetch at a time, error panel, tabs with
// arrow keys, persisted theme, JSON export and r/e/t shortcuts. Expects the
// shell ids of the index.html files: #app, #live, #refresh, #theme and
// optionally #export, #poll. The pure helpers are exported for tests.
import { observe } from './state.mjs';
import { el, icon, stateBadge, panel, fmt } from './components.mjs';

export const THEME_KEY = 'oneshots.theme';

// Stored theme, 'dark' when missing, invalid or storage is blocked.
export function readTheme(storage) {
  try {
    const t = storage?.getItem(THEME_KEY);
    return t === 'light' || t === 'dark' ? t : 'dark';
  } catch { return 'dark'; }
}

// Roving tabindex target for a key on tab `index` of `count`, wrapping; null
// for keys the tablist does not handle.
export function tabTarget(key, index, count) {
  const next = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: count - 1 }[key];
  return next === undefined || count < 1 ? null : (next + count) % count;
}

// Action for a global shortcut, null while typing or with modifiers.
export function shortcut(e, actions) {
  if (e.metaKey || e.ctrlKey || e.altKey || e.target?.closest?.('input, select, textarea')) return null;
  return Object.hasOwn(actions, e.key) ? actions[e.key] : null;
}

// One fetch at a time: load() during a running fetch returns that fetch;
// reload() waits for it and then fetches again, so a changed filter is never
// dropped. onData errors (render bugs) surface through onError as well.
export function createLoader({ fetchData, onData, onError, onBusy = () => {} }) {
  let pending = null;
  const load = () => {
    if (pending) return pending;
    onBusy(true);
    pending = Promise.resolve().then(fetchData).then(onData).catch(onError)
      .finally(() => { pending = null; onBusy(false); });
    return pending;
  };
  const reload = () => (pending ?? Promise.resolve()).then(load);
  return { load, reload };
}

export async function getJson(path, fetchImpl = globalThis.fetch) {
  const res = await fetchImpl(path, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

export function errorPanel(message) {
  return panel('Daten nicht verfügbar', stateBadge(observe({ error: true }, {})), el('div', { class: 'ui-empty', text: message }));
}

// fetchData() -> data; render(data, { now, loadedAt }) -> node(s) for #app;
// exportFile(data) -> { name, data } enables #export and the e shortcut;
// onView(tab) runs on tab change before the repaint; poll labels the status
// bar (#poll); pollMs refetches while visible; tickMs repaints countdowns.
export function mountPage({ fetchData, render, exportFile = null, onView = null, poll = null, pollMs = 0, tickMs = 0, keys = {}, doc = document }) {
  const $ = id => doc.getElementById(id);
  const root = doc.documentElement, app = $('app'), btn = $('refresh'), exportBtn = $('export');
  let data = null, loadedAt = null;

  const paint = () => {
    if (!data) return;
    const now = Date.now();
    app.replaceChildren(...[render(data, { now, loadedAt })].flat());
    if (poll && $('poll')) $('poll').textContent = `127.0.0.1 · ${poll} · zuletzt ${loadedAt ? `vor ${fmt.remaining(now - loadedAt)}` : '–'} · echte lokale Daten`;
  };

  const { load, reload } = createLoader({
    fetchData,
    onData: d => {
      data = d; loadedAt = Date.now();
      paint();
      if (exportBtn) exportBtn.disabled = false;
      $('live').textContent = `Aktualisiert ${new Date().toLocaleTimeString('de-AT')}`;
    },
    onError: err => {
      app.replaceChildren(errorPanel(`Abruf fehlgeschlagen (${err.message}). Läuft app/server.mjs?`));
      $('live').textContent = 'Aktualisierung fehlgeschlagen';
    },
    onBusy: busy => {
      btn.disabled = busy; app.setAttribute('aria-busy', String(busy));
      btn.replaceChildren(icon(busy ? 'loader-circle' : 'refresh-cw'), busy ? 'Lädt …' : 'Neu laden');
    },
  });

  const exportJson = () => {
    const file = data && exportFile?.(data);
    if (!file) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(file.data, null, 2)], { type: 'application/json' }));
    el('a', { href: url, download: file.name }).click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const applyTheme = theme => {
    root.dataset.theme = theme;
    $('theme').textContent = theme === 'dark' ? 'Hell' : 'Dunkel';
    try { localStorage.setItem(THEME_KEY, theme); } catch {}
  };
  const toggleTheme = () => applyTheme(root.dataset.theme === 'dark' ? 'light' : 'dark');

  const tabs = [...doc.querySelectorAll('[role=tab]')];
  const select = (tab, focus = false) => {
    for (const t of tabs) { const on = t === tab; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; }
    app.setAttribute('aria-labelledby', tab.id);
    if (focus) tab.focus();
    onView?.(tab.dataset.view);
    paint();
  };
  for (const t of tabs) {
    t.addEventListener('click', () => select(t));
    t.addEventListener('keydown', e => {
      const next = tabTarget(e.key, tabs.indexOf(t), tabs.length);
      if (next === null) return;
      e.preventDefault();
      select(tabs[next], true);
    });
  }

  applyTheme(readTheme((() => { try { return localStorage; } catch { return null; } })()));
  $('theme').addEventListener('click', toggleTheme);
  btn.addEventListener('click', load);
  if (exportBtn) {
    exportBtn.replaceChildren(icon('download'), 'JSON');
    exportBtn.addEventListener('click', exportJson);
  }
  const actions = { r: load, t: toggleTheme, ...(exportBtn ? { e: exportJson } : {}), ...keys };
  doc.addEventListener('keydown', e => shortcut(e, actions)?.());
  if (pollMs) setInterval(() => { if (!doc.hidden) load(); }, pollMs);
  if (tickMs) setInterval(paint, tickMs);
  load();
  return { load, reload, paint };
}
