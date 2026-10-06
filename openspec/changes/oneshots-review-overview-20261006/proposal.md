## Why
Martin will alle One-Shot-Prototypen (5 Canvas + 10 CLI-Dashboards) an einer Stelle prüfen: in echten iPhone-, Tablet- und Desktop-Größen, mit Markierungen direkt am Prototyp und einem Knopf, der sofort ein GitHub-Issue daraus macht. Bisher gibt es nur eine statische Galerie ohne Geräte-Größen, ohne Markieren und ohne Issue-Weg.

## What Changes
- Neue Projekt-Übersicht `index.html` (GitHub Pages), die alle One-Shot-HTML-Dateien automatisch listet: `manifest.json` liefert Namen und Kategorien, die GitHub-Contents-API ergänzt neue `.html`-Dateien ohne Manifest-Eintrag.
- Jeder Prototyp läuft in einem iframe mit Geräte-Rahmen und Größen-Umschalter (iPhone 390, iPhone 430, Tablet 820, Desktop 1440), live umschaltbar, automatisch eingepasst.
- Markier-Modus: Klick markiert ein Element, Ziehen markiert einen Bereich, dazu eine Text-Notiz. Markierungen bleiben im Browser gespeichert, stehen in einer sichtbaren Liste und lassen sich als JSON exportieren, kopieren und importieren.
- Knopf „Issue erstellen" je Markierung und gesammelt je Prototyp: öffnet einen vorausgefüllten Link `github.com/servas-ai/network-canvas-oneshots/issues/new?title=…&body=…` mit Tool, Gerät, Koordinaten, Element und Notiz. Kein Token, kein Backend.
- Die statische Galerie aus `feat/cli-dashboards` zieht nach `gallery.html` um, damit `index.html` frei für die Übersicht ist. Die 10 CLI-Dashboards kommen per Fast-Forward auf den Pages-Branch.
- Der semantische Element-Anker (Tag, id/data-testid, Rolle, Name, Text, DOM-Pfad, relativer Klickpunkt) ist aus `servas-ai/agent-installer` `apps/studio/canvas/anchors.mjs` (@8b121524) übernommen und verkleinert. Das Markierungs-Schema (rechteck/Text) folgt `services/baukasten-snipping`.

## Capabilities
### New Capabilities
- `oneshots-review`: Projekt-Übersicht mit automatischer Liste, Geräte-Vorschau, Live-Markierung, JSON-Export und Issue-Link.
### Modified Capabilities
_(keine)_

## Acceptance Criteria
- **AC1** Die Pages-URL `https://servas-ai.github.io/network-canvas-oneshots/` lädt die Übersicht und zeigt alle 15 One-Shots (5 Canvas + 10 CLI) in der Liste.
- **AC2** Eine `.html`-Datei im Pages-Branch ohne Manifest-Eintrag erscheint trotzdem in der Liste (API-Ergänzung), solange die GitHub-API erreichbar ist; ohne API bleibt die Manifest-Liste vollständig nutzbar.
- **AC3** Größen-Umschalter iPhone 390, iPhone 430, Tablet, Desktop ändert die echte iframe-Breite (Prototyp-`innerWidth` = gewählte Breite), mit Geräte-Rahmen.
- **AC4** Im Markier-Modus erzeugt Klick eine Element-Markierung (mit Element-Anker), Ziehen eine Bereichs-Markierung; Notiz-Text wird gespeichert; Markierung ist als Overlay sichtbar.
- **AC5** Markierungen erscheinen in einer Liste, überleben ein Neuladen (localStorage) und lassen sich als JSON exportieren (Download + Kopieren) und importieren.
- **AC6** „Issue erstellen" öffnet `https://github.com/servas-ai/network-canvas-oneshots/issues/new` mit vorausgefülltem Titel und Body (Tool, Datei-Link, Gerät, Koordinaten, Element, Notiz, JSON-Block). Kein Token und kein Backend im Code.
- **AC7** Die Übersicht selbst ist auf 390 px Breite ohne horizontales Scrollen bedienbar.
- **AC8** Beweis: Screenshots unter `.proof/2026-10-06_*.png` von der echten Pages-URL (Übersicht, iPhone-Ansicht, Markierung mit Notiz, Issue-Formular vorausgefüllt), selbst gesichtet.

## Impact
- Neue Dateien: `index.html`, `manifest.json`, `gallery.html` (umbenannt), `.nojekyll`, `openspec/`, `.proof/`.
- Pages-Branch `feat/canvas-oneshots` bekommt den Commit aus `feat/cli-dashboards` (Fast-Forward) plus diesen Change.
- Keine Abhängigkeiten, keine Secrets. Einziger externer Aufruf: öffentliche GitHub-Contents-API (ohne Token, 60 Anfragen/h, Ergebnis wird je Sitzung gepuffert).
