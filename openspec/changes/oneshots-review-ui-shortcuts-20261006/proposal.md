## Why
Martin (Goal-Update 6.10.2026): „mach das UI der Markier-Übersicht deutlich schöner (sauberes Design-System, Spacing, Dark/Light) UND mehr Tastatur-Shortcuts (m=markieren, i=Issue, n/p=nächstes/voriges One-Shot, 1-4=Gerätegröße, /=Suche)“. Die erste Fassung nutzt Emoji als Icons, Abstände sind frei gewählt, Dark-Mode folgt nur dem System und es gibt nur die Taste M.

## What Changes
- Design-System in `index.html`: Tokens für Farbe (Flächen, Text, Rand, Akzent, Markierung, Status), Abstände (4er-Raster), Radien, Schrift, Schatten, Fokus-Ring. Komponenten nutzen nur Tokens.
- Hell und Dunkel vollständig, Umschalter Auto/Hell/Dunkel (Knopf und Taste T), Wahl bleibt je Browser.
- Einheitliche Inline-SVG-Icons statt Emoji in Bedien-Elementen (Issue-Text behält Emoji).
- Tastenkürzel: M markieren, I Issue, N/P nächstes/voriges One-Shot, 1–4 Gerät, / Suche, ? Übersicht, T Thema, Esc schließt. Kürzel greifen auch, wenn der Fokus im Prototyp-iframe liegt, und nie beim Tippen.
- Tasten-Übersicht (Dialog) und Tasten-Chips an den Knöpfen (Desktop).
- Karten in der Liste sind anklickbar (Auswahl für I).

## Capabilities
### New Capabilities
- `oneshots-review-ui`: Design-System, Thema-Umschalter, Tastenkürzel der Review-Übersicht.

### Modified Capabilities
- (keine; Verhalten aus `oneshots-review-overview-20261006` bleibt)

## Akzeptanzkriterien
- **AC1** Farben, Abstände, Radien, Schrift und Schatten sind CSS-Tokens auf `:root`; Hex-Farben stehen nur in den Token-Blöcken (Ausnahme: Ampel-Punkte im Browser-Rahmen).
- **AC2** Hell und Dunkel vollständig; Umschalter Auto/Hell/Dunkel per Knopf und T; Wahl übersteht Neuladen. Beweis-Screenshots beider Themen.
- **AC3** E2E: M, I, N, P, 1, 2, 3, 4, /, ?, T, Esc tun das Erwartete; beim Tippen in Suche/Notiz passiert nichts; Kürzel wirken auch mit Fokus im iframe.
- **AC4** `?` zeigt alle Kürzel; Knöpfe nennen ihre Taste im Tooltip.
- **AC5** Bedien-Elemente nutzen Inline-SVG-Icons, keine Emoji.
- **AC6** iPhone 390: kein horizontales Scrollen, Bedien-Ziele ≥ 36 px; bisheriger E2E (38 Checks) bleibt grün.

## Impact
- `index.html` (CSS komplett neu strukturiert, Header/Leisten-Markup, neues Keyboard-Modul), `.proof/` (Screenshots, E2E-Ergebnis), README-Abschnitt Tastenkürzel.
