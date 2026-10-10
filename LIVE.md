## Funktionale Oberflächen (SERVAS-2071)

Die 15 HTML-Dateien im Wurzelverzeichnis bleiben Mockups mit Demodaten. Ab diesem Stand gibt es zusätzlich eine echte, datengetriebene Oberfläche und einen gemeinsamen Komponentenlayer, auf den weitere Oberflächen umziehen sollen.

```sh
npm start          # http://127.0.0.1:8874/ -> /live/
npm test           # 16 node:test-Fälle, keine Abhängigkeiten
```

| Pfad | Zweck |
|---|---|
| `shared/tokens.css` | Gemeinsame Tokens. Variablennamen entsprechen den Inline-Variablen der Mockups (`--bg`, `--panel`, `--text`, `--muted`, `--line`, `--soft`, `--accent`, `--tint`, `--green`, `--red`); Produkte überschreiben nur `--accent`/`--tint` per `data-product`. Hell/Dunkel per `data-theme`. |
| `shared/state.mjs` | `observe()`: Zustände `ready/stale/unknown/loading/error`, gleiche Semantik wie radar `toolState` (PR541, P1 PASS). Werte ohne Quelle und gültigen Zeitstempel werden nicht angezeigt. |
| `shared/components.mjs` | DOM-Bausteine `panel`, `metric`, `meter`, `table`, `bars`, `stateBadge`, `icon`, `fmt`. Text nur über `textContent`, Icons `aria-hidden`. |
| `app/collect.mjs` | Liest aus `~/.codex/sessions` und `~/.claude/projects` ausschließlich Tokenzahlen, Modellnamen, Zeitstempel und Codex-`rate_limits`. Prompts, Pfade und Credit-Guthaben werden verworfen, `auth.json`/Konfiguration nie geöffnet. |
| `app/server.mjs` | Lokaler Server, nur `127.0.0.1`, nur GET. `GET /api/usage?days=1..365`, 60 s Cache, höchstens eine Sammlung gleichzeitig. |
| `live/` | OpenCodex-Live-Nutzung: Summen, Tokens pro Tag, Konto-Quota (Codex-Fenster mit Reset), Modelle, Stundenprofil, Quellen. |

### Grenzen

- Quota gibt es nur für das Konto der lokalen Codex-Installation, so wie Codex es zuletzt gemeldet hat. Ist die Beobachtung älter als 6 h, steht sie auf „Veraltet“. Ist der Reset schon vorbei, wird kein Wert angezeigt.
- Weitere Konten im OpenCodex-Pool, CLIProxy-Management und Kosten in Euro sind nicht angebunden. Die UI zeigt dafür UNKNOWN und keine erfundenen Werte.
- Claude-Code-Logs enthalten keine Quota, nur Nutzung.
- „Tokens gesamt“ zählt Cache-Lesezugriffe mit. Ihr Anteil wird separat ausgewiesen.

### Nachweise

`screenshots/live/usage-{dark,light}.png` und `browser-check.json` wurden mit `qa/live-browser-check.cjs` in einer bcli-Cloud-Session über einen Tunnel zum lokalen Server erzeugt (`CDP_URL` aus `bcli session create`). Geprüft wurden: kein horizontaler Überlauf, Zustandsbadges, Meter-Wert, Aktualisierung per Tastatur (Enter auf dem nativen Button) und der Wechsel auf 24 h.
