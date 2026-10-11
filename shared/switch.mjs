// SERVAS-2071 pure CC Switch view logic for switch/ (no I/O, no DOM). Input is
// GET /api/switch (app/switch.mjs, whitelisted) and /api/usage. Nothing here
// can switch a provider: the surface is read only.

// Local gateway port -> functional surface of this suite.
export const GATEWAY_PAGES = Object.freeze({ 8317: '../cpa/', 3456: '../router/', 10100: '../opencodex/' });

// Endpoint -> { title, detail, link }. custom/invalid never show a host.
export function endpointText(ep) {
  if (!ep) return { title: 'Unbekannt', detail: 'Kein Endpunkt belegt', link: null };
  if (ep.kind === 'local') return { title: ep.label, detail: `localhost:${ep.port}`, link: GATEWAY_PAGES[ep.port] ?? null };
  if (ep.kind === 'known') return { title: ep.label, detail: ep.default ? `${ep.host ?? ep.label} · Standard` : ep.host ?? 'öffentlicher Endpunkt', link: null };
  if (ep.kind === 'invalid') return { title: 'Ungültige Adresse', detail: 'Basis-URL ist keine http(s)-Adresse', link: null };
  return { title: 'Eigener Endpunkt', detail: 'Adresse wird nicht angezeigt', link: null };
}

const CREDENTIAL = Object.freeze({
  env: 'Schlüssel per Umgebungsvariable · Wert nie gelesen',
  helper: 'apiKeyHelper-Skript · Ausgabe nie gelesen',
  login: 'Anmeldung von Claude Code · kein Schlüssel in settings.json',
  'oauth-personal': 'Google-Anmeldung', 'gemini-api-key': 'Gemini-API-Schlüssel', 'vertex-ai': 'Vertex AI',
  'cloud-shell': 'Cloud Shell', 'compute-default-credentials': 'Compute-Standardkonto',
});
// Mode -> text; null for unknown so the surface shows UNKNOWN with a reason.
export const credentialText = mode => (Object.hasOwn(CREDENTIAL, mode) ? CREDENTIAL[mode] : null);
export const UNKNOWN_CREDENTIAL = Object.freeze({
  codex: 'auth.json wird nie geöffnet: ChatGPT-Anmeldung oder API-Schlüssel ist hier nicht belegbar',
  gemini: 'settings.json nennt keine Anmeldeart',
  claude: 'Keine Anmeldeart belegt',
});

// Tool card state: not installed, invalid config, defaults (no file), configured.
export function toolStatus(tool) {
  if (!tool?.installed) return { state: 'unknown', icon: 'circle-help', text: 'Nicht installiert' };
  const c = tool.config;
  if (!c) return { state: 'unknown', icon: 'circle-help', text: 'Keine Konfiguration' };
  if (!c.valid) return { state: 'error', icon: 'triangle-alert', text: 'Konfiguration ungültig' };
  if (c.missing) return { state: 'ready', icon: 'circle-check', text: 'Standardwerte' };
  return { state: 'ready', icon: 'circle-check', text: 'Aktiv' };
}

// Skill name -> per tool presence; tools without a skills folder -> null (unknown), not false.
export function skillMatrix(tools = []) {
  const names = [...new Set(tools.flatMap(t => t.skills ?? []))].sort();
  return names.map(name => ({ name, ...Object.fromEntries(tools.map(t => [t.id, t.skills ? t.skills.includes(name) : null])),
    shared: tools.every(t => t.skills?.includes(name)) }));
}

// Newest session-log activity of a tool in the usage window; gemini has no
// collector -> undefined (unknown), a collector without activity -> null.
export function lastUse(usage, id) {
  const src = (usage?.sources ?? []).find(s => s.id === id);
  return src ? src.observedAt ?? null : undefined;
}

// Why the local Codex quota windows do not apply to this tool's route, or null
// when they do: they belong to the OpenAI login, not to another provider, and
// an unreadable config leaves the provider unknown.
export function quotaScope(tool) {
  if (tool?.id !== 'codex') return null;
  if (!tool.config?.valid) return 'Provider unbekannt: config.toml nicht lesbar, Quota nicht zuordenbar';
  return tool.config.provider === 'openai' ? null : 'Codex-Quota gilt für die OpenAI-Anmeldung, nicht für diesen Provider';
}

export const counts = tools => ({
  mcp: tools.reduce((s, t) => s + t.mcp.servers.length, 0),
  skills: new Set(tools.flatMap(t => t.skills ?? [])).size,
  prompts: tools.filter(t => Number.isFinite(t.prompt?.bytes)).length,
  backups: tools.reduce((s, t) => s + t.backups.length, 0),
});
