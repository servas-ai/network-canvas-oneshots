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
- **Planung:** OpenSpec [`oneshots-review-overview-20261006`](./openspec/changes/oneshots-review-overview-20261006/proposal.md). Die frühere statische Galerie liegt jetzt unter [`gallery.html`](./gallery.html).

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
