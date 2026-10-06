## 1. Design-System
- [x] 1.1 Token-Blöcke (hell, dunkel, data-theme) für Farbe, Abstand, Radius, Schrift, Schatten, Fokus (Beleg: `index.html` `:root`-Blöcke; E2E „AC1 hex colors only in token blocks“ und „tokens defined“ grün)
- [x] 1.2 Komponenten (Knöpfe, Segment, Liste, Leisten, Karten, Dialoge, Toast) auf Tokens umstellen (Beleg: `.proof/2026-10-06_r1-desktop-hell-markierungen.png`, `…-dunkel-markierungen.png`)
- [x] 1.3 Inline-SVG-Icon-Sprite statt Emoji in Bedien-Elementen (Beleg: E2E „AC5 controls use SVG icons, no emoji“: 35 SVG, 0 Emoji)
- [x] 1.4 Thema-Umschalter Auto/Hell/Dunkel mit Speicher (try/catch) (Beleg: E2E „AC2 T: Auto -> Hell -> Dunkel“, „Dunkel survives reload“, „Auto follows system dark“)

## 2. Tastenkürzel
- [x] 2.1 Zentrales Keyboard-Modul (M, I, N, P, 1–4, /, ?, T, Esc + J/K/R/H), Schutz beim Tippen (Beleg: E2E AC3, 22 Checks grün, darunter „typing n1m in search triggers nothing“, „typing in note dialog triggers nothing“)
- [x] 2.2 Weiterleitung aus dem gleich-origin iframe (Beleg: E2E „key 2 works with focus in iframe“, „typing in a contenteditable of the prototype triggers nothing“)
- [x] 2.3 Tasten-Übersicht (Dialog) und Tasten im Tooltip / als Chip (Beleg: `.proof/2026-10-06_r1-tastenkuerzel-hell.png`, `…-dunkel.png`; E2E „every shortcut button names its key“)
- [x] 2.4 Karten anklickbar (Auswahl für I) (Beleg: E2E „Card click selects marking“, „I -> issue for selected marking“)

## 3. Beweis
- [x] 3.1 E2E erweitert, alter Lauf bleibt grün (Beleg: auf der Pages-URL 37/37 neu (`.proof/2026-10-06_r1-e2e-result.json`) und 38/38 alt)
- [x] 3.2 Screenshots hell + dunkel, Desktop + iPhone 390, Tasten-Übersicht, selbst gesichtet (Beleg: 8 Dateien `.proof/2026-10-06_r1-*.png`)
- [x] 3.3 Push, Pages-Check, Runde an L13 gemeldet (Beleg: Commit fb4d5c7, Pages-Build built, `.proof/2026-10-06_oneshots-review-runden.md`)
