// SERVAS-2071 functional CC Switch surface (replaces the cc-switch.html mockup
// data). Data: GET /api/switch (whitelisted Claude Code / Codex / Gemini CLI
// configs, MCP and skill names, prompt/backup sizes) and GET /api/usage?days=2
// (last session-log activity, Codex quota windows). Read only: the mockup's
// "Activate", "Edit" and "Test" have no write path here; provider balances,
// Claude and Gemini quota have no source: UNKNOWN, never mockup values.
import { observe } from '../shared/state.mjs';
import { trayModel, PROVIDERS } from '../shared/quota.mjs';
import { endpointText, credentialText, UNKNOWN_CREDENTIAL, toolStatus, skillMatrix, lastUse, counts } from '../shared/switch.mjs';
import { el, icon, stateBadge, panel, meter, table, fmt } from '../shared/components.mjs';
import { mountPage, getJson } from '../shared/page.mjs';

const USAGE_MAX_AGE = 24 * 3600e3;
let data = null, usage = null, view = 'providers';

const count = v => (Number.isFinite(v) ? v.toLocaleString('de-AT') : '–');
const unknownBadge = now => stateBadge(observe({}, { now }));
const tools = () => data.tools;
const bytes = v => (Number.isFinite(v) ? (v < 1024 ? `${count(v)} B` : `${(v / 1024).toLocaleString('de-AT', { maximumFractionDigits: 1 })} KB`) : '–');

function badge(state, iconName, text) {
  return el('span', { class: 'ui-badge', role: 'status', dataset: { state } }, icon(iconName), text);
}
const statusBadge = t => { const s = toolStatus(t); return badge(s.state, s.icon, s.text); };

function notice() {
  const active = tools().filter(t => t.config?.valid).length;
  return el('section', { class: 'ui-panel' }, el('div', { class: 'between' },
    el('div', {}, el('strong', { text: `${active} von ${tools().length} Werkzeugen mit lesbarer Konfiguration` }),
      el('div', {}, el('small', { text: 'Nur lesend: Provider wechseln, bearbeiten und testen ist hier nicht freigegeben. Schlüssel, Adressen und Inhalte werden nie gelesen.' }))),
    badge('unknown', 'circle-help', 'Umschalten nicht verfügbar')));
}

function row(label, value, hint) {
  return el('div', { class: 'row' }, el('div', { class: 'between' }, el('small', { text: label }), value), hint ? el('small', { text: hint }) : null);
}

function quotaRows(t, now) {
  const p = PROVIDERS.find(x => x.id === t.id);
  const model = trayModel(usage.quotas, { now }).providers.find(x => x.id === t.id);
  const windows = model?.accounts.flatMap(a => a.windows) ?? [];
  // Quota belongs to the local Codex login; with another provider it says nothing about this route.
  const own = t.id !== 'codex' || t.config?.provider === 'openai';
  if (!windows.length || !own) return row('Quota', unknownBadge(now), !own ? 'Codex-Quota gilt für die OpenAI-Anmeldung, nicht für diesen Provider' : p?.reason ?? 'Kein Quota-Fenster im Zeitraum');
  return el('div', { class: 'row wins' }, el('small', { text: 'Quota (Codex-Fenster)' }), windows.map(w => el('div', {},
    el('div', { class: 'between' }, el('small', { text: fmt.window(w.windowMinutes) }),
      w.obs.value === null ? stateBadge(w.obs) : el('small', { text: `${count(Math.round(w.obs.value))} % genutzt` })),
    meter(w.obs.value, `Codex ${fmt.window(w.windowMinutes)}`),
    w.remainingMs !== null ? el('small', { text: `Reset in ${fmt.remaining(w.remainingMs)}` }) : null)));
}

function toolCard(t, now) {
  const c = t.config?.valid ? t.config : null;
  const ep = c ? endpointText(c.endpoint) : null;
  const cred = c && credentialText(c.credential);
  const seen = lastUse(usage, t.id);
  const obs = observe({ source: `log:${t.id}`, observedAt: seen, value: seen ? 1 : null }, { now, maxAgeMs: USAGE_MAX_AGE });
  return el('section', { class: 'ui-panel tool', dataset: { kind: c?.endpoint?.kind ?? 'none' } },
    el('header', {}, el('h2', { text: t.label }), statusBadge(t)),
    c ? [
      el('div', { class: 'provider', text: ep.title }),
      el('div', {}, el('small', { class: 'mono', text: ep.detail }), ep.link ? [' · ', el('a', { class: 'link', href: ep.link, text: 'Oberfläche öffnen' })] : null),
      row('Modell', c.model ? el('strong', { class: 'mono', text: c.model }) : el('small', { text: 'Standard des Werkzeugs' }),
        t.id === 'codex' && c.effort ? `Reasoning ${c.effort}` : null),
      t.id === 'claude' ? row('Modell-Zuordnung', el('small', { class: 'mono', text: ['opus', 'sonnet', 'haiku', 'fast'].map(k => `${k}: ${c.models[k] ?? '–'}`).join(' · ') })) : null,
      t.id === 'codex' ? row('Provider-ID', el('strong', { class: 'mono', text: c.provider }), c.profile ? `Profil ${c.profile}` : c.profiles.length ? `${c.profiles.length} Profile, keins aktiv` : null) : null,
      row('Anmeldung', cred ? el('small', { text: cred }) : unknownBadge(now), cred ? null : UNKNOWN_CREDENTIAL[t.id]),
    ] : el('div', { class: 'ui-empty', text: !t.installed ? `~/${t.configFile.split('/')[1]} fehlt: ${t.label} ist hier nicht eingerichtet` : `${t.configFile} lässt sich nicht lesen · geändert ${fmt.dateTime(t.config?.modifiedAt)}` }),
    row('Letzte Nutzung', seen === undefined ? unknownBadge(now) : stateBadge(obs),
      seen === undefined ? 'Kein Session-Log-Collector für dieses Werkzeug' : seen ? fmt.dateTime(seen) : 'Keine Anfrage in 48 h'),
    quotaRows(t, now),
    el('small', { text: c?.missing ? `${t.configFile} fehlt · Standardwerte` : c ? `${t.configFile} · geändert ${fmt.dateTime(c.modifiedAt)}` : t.configFile }));
}

function codexProviders(now) {
  const c = tools().find(t => t.id === 'codex')?.config;
  if (!c?.valid) return panel('Codex-Provider', unknownBadge(now), el('div', { class: 'ui-empty', text: 'Keine lesbare config.toml' }));
  return panel('Codex-Provider', el('small', { text: 'model_providers in config.toml' }), el('div', { class: 'scroll' }, table([
    { key: 'id', label: 'ID', format: v => v },
    { key: 'endpoint', label: 'Endpunkt', format: v => { const e = endpointText(v); return `${e.title} · ${e.detail}`; } },
    { key: 'active', label: 'Status', format: v => (v ? 'Aktiv' : '–') },
  ], c.providers.map(p => ({ ...p, active: p.id === c.provider })), 'Keine eigenen Provider · Codex nutzt eingebaute')));
}

function providersView(now) {
  return [notice(), el('div', { class: 'tools' }, tools().map(t => toolCard(t, now))), codexProviders(now)];
}

function mcpView(now) {
  const rows = tools().flatMap(t => t.mcp.servers.map(s => ({ ...s, tool: t.label })));
  const broken = tools().filter(t => t.mcp.valid === false);
  return [panel('MCP-Server', el('small', { text: `${count(rows.length)} aus Benutzer-Konfigurationen` }),
    el('div', { class: 'scroll' }, table([
      { key: 'name', label: 'Name' },
      { key: 'transport', label: 'Transport' },
      { key: 'tool', label: 'Werkzeug' },
    ], rows, 'Keine MCP-Server eingetragen')),
    broken.length ? el('div', { class: 'row' }, el('div', { class: 'between' }, el('strong', { text: 'Nicht lesbar' }), badge('error', 'triangle-alert', broken.map(t => t.label).join(', ')))) : null,
    el('div', { class: 'row' }, el('div', { class: 'between' }, el('strong', { text: 'Projekt-Server und Erreichbarkeit' }), unknownBadge(now)),
      el('small', { text: 'Nur Name und Transport. Befehl, Argumente, Adresse, Header und env werden nie gelesen; MCP-Server werden nicht gestartet.' })))];
}

function skillsView(now) {
  const matrix = skillMatrix(tools());
  const mark = v => (v === null ? 'unbekannt' : v ? '✓' : '–');
  return [panel('Skills', el('small', { text: `${count(matrix.length)} Namen · ${count(matrix.filter(m => m.shared).length)} in allen Werkzeugen` }),
    el('div', { class: 'scroll' }, table([
      { key: 'name', label: 'Skill' },
      ...tools().map(t => ({ key: t.id, label: t.label, format: mark })),
    ], matrix, 'Keine Skills gefunden')),
    el('div', { class: 'row' }, el('div', { class: 'between' }, el('strong', { text: 'Inhalt und Synchronität' }), unknownBadge(now)),
      el('small', { text: 'Gezählt werden Ordner mit SKILL.md. Ob gleichnamige Skills denselben Inhalt haben, wird nicht geprüft.' })))];
}

function filesView() {
  return [el('div', { class: 'split' },
    panel('Globale Prompts', el('small', { text: 'nur Größe und Änderungszeit' }), el('div', { class: 'scroll' }, table([
      { key: 'tool', label: 'Werkzeug' },
      { key: 'file', label: 'Datei', format: v => v },
      { key: 'bytes', label: 'Größe', num: true, format: (v, r) => (r.exists ? bytes(v) : 'fehlt') },
      { key: 'modifiedAt', label: 'Geändert', format: v => (v ? fmt.dateTime(v) : '–') },
    ], tools().map(t => ({ tool: t.label, ...t.prompt, exists: Number.isFinite(t.prompt.bytes) }))))),
    panel('Backups', el('small', { text: 'Sicherungen neben der Konfiguration' }), el('div', { class: 'scroll' }, table([
      { key: 'tool', label: 'Werkzeug' },
      { key: 'name', label: 'Datei' },
      { key: 'bytes', label: 'Größe', num: true, format: bytes },
      { key: 'modifiedAt', label: 'Geändert', format: v => fmt.dateTime(v) },
    ], tools().flatMap(t => t.backups.map(b => ({ tool: t.label, ...b }))), 'Keine Backups gefunden'))))];
}

function summary() {
  const n = counts(tools());
  return el('small', { text: `${count(n.mcp)} MCP-Server · ${count(n.skills)} Skills · ${count(n.prompts)} globale Prompts · ${count(n.backups)} Backups` });
}

function render({ switch: s, usage: u }, { now }) {
  data = s; usage = u;
  const views = { providers: () => providersView(now), mcp: () => mcpView(now), skills: () => skillsView(now), files: () => filesView() };
  return el('div', { style: 'display:grid;gap:12px' }, summary(), views[view]());
}

mountPage({
  // sequential: the server runs one collection at a time
  fetchData: async () => ({ switch: await getJson('/api/switch'), usage: await getJson('/api/usage?days=2') }),
  render,
  exportFile: d => ({ name: `cc-switch-${d.switch.generatedAt.slice(0, 10)}.json`, data: d }),
  onView: v => { view = v; },
  poll: 'Abfrage jede Minute', pollMs: 60e3, tickMs: 30e3,
});
