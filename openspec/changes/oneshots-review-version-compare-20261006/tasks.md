## 1. Versionen
- [x] 1.1 Versions-Loader: Aktuell, Manifest-`versions`, Branches, Datei-Verlauf, eigene Ref (API gepuffert) (Beleg: `manifest.json` `versions` = `feat/premium-oneshots`; E2E „free ref (commit bf02f87) loads as B“; API-403 bricht nichts)
- [x] 1.2 raw → `srcdoc` mit `<base>`, gleiche Herkunft, SHA auflösen (Beleg: E2E „B loads via raw -> srcdoc (same origin, DOM readable)“; Markierung speichert `sha: bbb9e60`)

## 2. Vergleichs-Bühne
- [x] 2.1 Ansichten Nebeneinander, Schieber, Überblenden, Taste C, Esc (Beleg: E2E „slider drag to 30 % clips B“, „Überblenden: B opacity follows the slider“; `.proof/2026-10-06_r3-miro-*.png`)
- [x] 2.2 Gerät je Seite, Scroll-Kopplung, Schieber per Pfeiltasten (Beleg: E2E „device per side (390/1440)“, „scroll sync: B follows A (9router)“, „switched off“, „arrow keys“)
- [x] 2.3 Markieren auf beiden Seiten, Markierung speichert ref + SHA, Issue nennt Version (Beleg: E2E „marking on V2 stores ref“, „marking issue names the version“, „per version (hidden on Aktuell)“; `.proof/2026-10-06_r3-markierung-auf-v2.png`)
- [x] 2.4 Teilbarer Link `?vergleich=&modus=` (Beleg: E2E „deep link ?vergleich=&modus= opens the compare view“)

## 3. Beweis
- [x] 3.1 E2E auf Pages: V1 gegen Premium-V2 (Canvas Miro + CLI OpenCodex/9router), alle Ansichten (Beleg: 22/22, `.proof/2026-10-06_r3-e2e-result.json`)
- [x] 3.2 Screenshots selbst gesichtet, Push, Runde an L13 (Beleg: 6 Dateien `.proof/2026-10-06_r3-*.png`, Commits 0eb7532 · 475bce5 · 59f44ff)
