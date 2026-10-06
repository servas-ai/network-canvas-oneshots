# Network Canvas & CLI Dashboard Prototypes

A collection of **15 high-fidelity, self-contained single-file HTML one-shot prototypes** covering top proprietary whiteboard canvases, proxy control planes, and usage dashboards.

## 🔍 Review-Übersicht (live markieren → GitHub-Issue)

**Öffnen:** https://servas-ai.github.io/network-canvas-oneshots/ · Quelltext [`index.html`](./index.html)

1. **Prototyp wählen** (Liste links, auf dem Handy oben im Menü). Alle One-Shots kommen aus [`manifest.json`](./manifest.json); neue `.html`-Dateien im Branch ergänzt die GitHub-API automatisch.
2. **Gerät wählen:** 📱 iPhone 390 · 📱 iPhone 430 · 📲 Tablet 820 · 🖥️ Desktop 1440. Der Prototyp läuft in echter Breite, nur die Anzeige wird eingepasst. ⟳ dreht auf quer, ⤢ zeigt 1:1.
3. **✏️ Markieren** (oder Taste `M`): **Klicken** markiert ein Element, **Ziehen** einen Bereich. Notiz schreiben, Speichern.
4. **🐞 Issue erstellen:** GitHub öffnet ein fertig ausgefülltes Formular (Tool, Gerät, Koordinaten, Element, Notiz, JSON). Nur noch „Create“ drücken. Kein Token, kein Server.

- **Markierungen abholen:** Liste rechts · ⬇ JSON (Datei) · 📋 Kopieren · ⬆ Laden. Sie bleiben im Browser gespeichert (localStorage).
- **Im Issue** steht ein Link „Markierung in der Übersicht öffnen“: er zeigt die Markierung auf jedem Gerät wieder an.
- **Agenten** finden alle Review-Issues mit `gh issue list -R servas-ai/network-canvas-oneshots --search "[Review] in:title"`; der JSON-Block im Body hat das Schema `oneshots-review/markierungen@1`.
- **Neue One-Shot hinzufügen:** `.html` + `screenshots/<name>.png` ins Repo-Root, dann `python3 scripts/update-manifest.py` (trägt sie mit Titel ein; Kategorie danach im Manifest anpassen).
- **Thema:** Auto (System), Hell oder Dunkel über den Knopf oben rechts oder Taste `T`. Die Wahl bleibt im Browser.
- **Planung:** OpenSpec [`oneshots-review-overview-20261006`](./openspec/changes/oneshots-review-overview-20261006/proposal.md), [`oneshots-review-ui-shortcuts-20261006`](./openspec/changes/oneshots-review-ui-shortcuts-20261006/proposal.md). Die frühere statische Galerie liegt jetzt unter [`gallery.html`](./gallery.html).

### 🎙 Sprach-Notiz (zeigen + sprechen)

1. **Brücke starten** (einmal, im Repo-Ordner): `node scripts/voice-bridge.mjs --open`. Sie öffnet die Übersicht schon gekoppelt. Den Kopplungscode kann man auch in den Sprach-Einstellungen (Pfeil neben „Sprechen“) eintragen.
2. **Zeiger auf die Stelle** im Prototyp, Taste `V` (oder „Sprechen“), reden. Jede Passage (Pause trennt) wird eine Markierung an der Stelle, auf die der Zeiger am Anfang der Passage zeigt. Zeiger weiter, weiterreden: nächste Stelle. Gleiche Stelle: Text wird angehängt.
3. `V` oder `Enter` beendet, `V` halten = sprechen, solange gedrückt. `Esc` bricht ab. Auf dem iPhone: „Sprechen“ tippen, dann die Stelle antippen.

- **Erkennung (umschaltbar):** Lokal · whisper.cpp (Standard, Audio bleibt auf dem Rechner; die Brücke startet `whisper-server` mit `~/.whisper-models/ggml-base.bin` selbst) · Grok Voice über den Harness auf `127.0.0.1:9381` · Browser-Spracherkennung (nicht in Brave) · Tippen.
- **Eigener Adapter:** `window.OneshotsVoice.register({ id, label, desc, available, start(cb), stop })`; `cb` hat `onSpeechStart(key)`, `onPartial(key, text)`, `onFinal(key, text)`, `onLevel(rms)`, `onError(msg)`.
- **Sicherheit:** Die Brücke lauscht nur auf 127.0.0.1, nimmt nur `https://servas-ai.github.io` und Loopback an, braucht den Token dieses Starts (nie im Code) und prüft den Host-Header. Die Schutzregel des Voice-Harness bleibt unverändert; die Brücke spricht ihn serverseitig an. Optionen: `STT_URL` (OpenAI-kompatibel geht auch), `WHISPER_MODEL`, `GROK_VOICE_URL`.

### ⌨️ Tastenkürzel (`?` zeigt alle)

- **Navigation:** `N` nächstes / `P` voriges One-Shot · `/` Suche (Enter öffnet den ersten Treffer) · `J` / `K` nächste / vorige Markierung
- **Markieren:** `M` Markier-Modus · `V` Sprach-Notiz · `I` Issue für die gewählte Markierung (sonst alle des Tools) · `⌘ Enter` speichern · `⇧ ⌘ Enter` speichern + Issue
- **Ansicht:** `1` iPhone 390 · `2` iPhone 430 · `3` Tablet 820 · `4` Desktop 1440 · `R` quer/hochkant · `H` Markierungen ein/aus
- **Allgemein:** `T` Thema · `?` Übersicht · `Esc` schließen bzw. Markieren beenden

Die Kürzel wirken auch, wenn der Fokus im Prototyp liegt, nie aber beim Tippen in der Suche, in der Notiz oder in editierbaren Feldern des Prototyps.

---

## 🎨 Suite 1: Proprietary Canvas & Whiteboard Prototypes (5)

| Tool | Prototype File | Form / Architecture | Vision QG |
| :--- | :--- | :--- | :---: |
| **Miro** | [`miro.html`](./miro.html) | Infinite Pan/Zoom Canvas, Draggable Sticky Notes, Frames, Collaborator Cursor | 🟢 **PASS** |
| **FigJam** | [`figjam.html`](./figjam.html) | Playful Whiteboard, Floating Tool Dock, Section Containers, Reaction Stamps | 🟢 **PASS** |
| **Lucidchart** | [`lucidchart.html`](./lucidchart.html) | Enterprise Diagramming Grid, Left Shape Dock, Inspector, Orthogonal Connectors | 🟢 **PASS** |
| **Whimsical** | [`whimsical.html`](./whimsical.html) | High-Speed Mind Map, Mode Switcher, Card Status Badges, Branching Bezier Curves | 🟢 **PASS** |
| **Mural** | [`mural.html`](./mural.html) | Facilitator Suite, Countdown Timer, Voting Session, 2x2 Matrix Template | 🟢 **PASS** |

---

## ⚡ Suite 2: CLI Proxy & Usage Dashboards (10)

| Tool | Prototype File | Form & Interactive Focus | Vision QG |
| :--- | :--- | :--- | :---: |
| **OpenCodex** | [`opencodex.html`](./opencodex.html) | Web + Tray: Multi-account pool, 5h/week bars, auto-switch engine on 429 | 🟢 **PASS** |
| **CPA-Manager-Plus** | [`cpa-manager-plus.html`](./cpa-manager-plus.html) | Web Ops: 6-node health matrix, live traffic throughput chart, token mix spectrum | 🟢 **PASS** |
| **Magpie** | [`magpie.html`](./magpie.html) | Desktop / TUI: Model switcher dropdown & routing groups builder without config edit | 🟢 **PASS** |
| **EasyCLIProxy** | [`easycliproxy.html`](./easycliproxy.html) | Desktop App: OAuth cards (OpenAI, Anthropic, Google, xAI), endpoints & quota lookup | 🟢 **PASS** |
| **CLIProxy Quota Tray** | [`cliproxy-quota-tray.html`](./cliproxy-quota-tray.html) | macOS Tray: Compact popover with Codex Pro 5h limit & Grok week/month gauges | 🟢 **PASS** |
| **CC Switch** | [`cc-switch.html`](./cc-switch.html) | Desktop App: Provider row with dual 5h & 7-day quota percentages & instant switch | 🟢 **PASS** |
| **9Router** | [`9router.html`](./9router.html) | Web Gateway: 3-stage fallback cascade (Abo → Günstig → Frei) with request simulator | 🟢 **PASS** |
| **Claude Code Router** | [`claude-code-router.html`](./claude-code-router.html) | Control Plane: 200k context gauge, active tool interceptor hooks & rate-limit warden | 🟢 **PASS** |
| **cliproxyapi-usage** | [`cliproxyapi-usage.html`](./cliproxyapi-usage.html) | Web Analytics: 5h & 7-day residual allowance per account + local machine burn breakdown | 🟢 **PASS** |
| **Tokscale** | [`tokscale.html`](./tokscale.html) | Terminal / TUI: 52-week GitHub-style contribution heatmap & hourly Tagesraster | 🟢 **PASS** |

---

## 🖼️ Gallery Project Showroom

The static visual showroom is located at [`gallery.html`](./gallery.html), featuring interactive category filtering, live prototype links, and high-resolution screenshots generated via `opencli browser screenshot`.
