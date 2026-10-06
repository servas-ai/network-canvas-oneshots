## 1. Basis
- [x] 1.1 `feat/cli-dashboards` per Fast-Forward auf `feat/canvas-oneshots` holen, deren Galerie `index.html` → `gallery.html` umbenennen (Beleg: Fast-Forward 36c58b5..3930442, `git mv index.html gallery.html`)
- [x] 1.2 `manifest.json` mit allen 15 Prototypen (Datei, Titel, Kategorie, Beschreibung, Screenshot) anlegen (Beleg: manifest.json, 15 items, aus gallery.html generiert; scripts/update-manifest.py)
- [x] 1.3 `.nojekyll` anlegen, damit Pages die Dateien unverändert ausliefert (Beleg: .nojekyll)

## 2. Übersicht `index.html`
- [x] 2.1 Liste aus Manifest + GitHub-Contents-API (Ergänzung, sessionStorage-Puffer, Ausfall-sicher) (Beleg: index.html:582 discover(); E2E AC2 Mock-API +1 „Neu“, 403 → 15 aus Manifest)
- [x] 2.2 Geräte-Bühne: iframe mit Rahmen, Umschalter 390/430/820/1440, Einpassen per Skalierung, Auswahl in der URL (Beleg: index.html:707 fit(), :659 syncUrl(); E2E innerWidth 390/430/820/1440)
- [x] 2.3 Markier-Modus: Klick = Element (Anker aus agent-installer `anchors.mjs`), Ziehen = Bereich, Notiz-Dialog, Escape bricht ab (Beleg: index.html:768 selectorOf, :782 anchorOf, :883 startDraft; E2E Klick=element, Ziehen=bereich 40/600/260×120, Esc verwirft)
- [x] 2.4 Overlay der gespeicherten Markierungen, folgt dem Scrollen im Prototyp (Beleg: index.html:1016 renderOverlay (Scroll-Versatz); E2E 2 Boxen sichtbar)
- [x] 2.5 Markierungs-Liste, localStorage mit try/catch, JSON exportieren/kopieren/importieren (Beleg: index.html:504 loadMarks, :1098 Export; E2E Reload behält 2, Download oneshots-markierungen-2026-10-06.json)
- [x] 2.6 „Issue erstellen" je Markierung und gesammelt je Prototyp, Längen-Fallback über Zwischenablage (Beleg: index.html:1154 issueText, :1175 openIssue; E2E Titel/Body/Länge 4063 < 7000, Bündel „[Review] Miro · 2 Markierungen“)
- [x] 2.7 Telefon-Layout 390 px ohne horizontales Scrollen, helles und dunkles Farbschema (Beleg: index.html:258 Media-Query; E2E scrollWidth 390, Touch-Markierung + Sheet)

## 3. Prüfen und ausliefern
- [x] 3.1 Lokal mit echtem Browser prüfen: 15 Einträge, `innerWidth` = Gerätebreite, Markierung + Neuladen, Issue-URL dekodiert korrekt (Beleg: E2E 38/38 PASS lokal in Brave headless (Temp-Profil))
- [x] 3.2 README um Übersicht und Markier-Weg ergänzen (Beleg: README.md Abschnitt „Review-Übersicht“)
- [ ] 3.3 Push auf `feat/canvas-oneshots`, Pages-Build abwarten
- [ ] 3.4 Auf der echten Pages-URL prüfen und Screenshots nach `.proof/2026-10-06_*.png` (Übersicht, iPhone, Markierung, Issue-Formular), selbst gesichtet
- [ ] 3.5 `openspec validate oneshots-review-overview-20261006 --strict` grün
