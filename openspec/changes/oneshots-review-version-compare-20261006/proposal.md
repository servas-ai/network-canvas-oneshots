## Why
Martin (Zusatz-Goal 6.10.2026): „V1/V2-Versionsvergleich je One-Shot (Slider/Side-by-side, 'weiterdenken')“. Eine zweite Lane baut gerade Premium-Fassungen aller 15 One-Shots (`~/code/premium-oneshots`, Branch `feat/premium-oneshots`, gesichert als Commit `bf02f87`). Ohne Vergleich sieht niemand, ob V2 wirklich besser ist.

## What Changes
- Vergleichs-Modus je One-Shot (Knopf und Taste C) mit drei Ansichten:
  - **Nebeneinander**: zwei Geräte-Rahmen, Scrollen gekoppelt (abschaltbar).
  - **Schieber**: beide Versionen übereinander, senkrechter Trenner per Maus, Touch und Pfeiltasten.
  - **Überblenden**: Deckkraft-Regler (Zwiebelhaut), zeigt kleine Verschiebungen.
- Versionen kommen aus:
  - **Aktuell**: die Pages-Datei.
  - **Manifest**: `versions` mit Git-Refs, z. B. `feat/premium-oneshots`.
  - **Alle Branches** des Repos und **Verlauf** der Datei (öffentliche GitHub-API, gepuffert).
  - **Eigene Ref**: Branch oder Commit von Hand.
- Fremde Versionen laden über `raw.githubusercontent.com` (CORS offen) in ein `srcdoc`-iframe. Dadurch gleiche Herkunft, Markieren funktioniert auf beiden Seiten.
- Markierungen merken die Version (`ref`, kurzer SHA). Der Issue-Text nennt sie.
- **Weiterdenken:** jede Seite hat ihr eigenes Gerät (z. B. V1 iPhone gegen V2 iPhone, oder V2 iPhone gegen V2 Desktop). Die Ansicht ist per Link teilbar (`?vergleich=<ref>&modus=`). Ein Vergleichs-Issue nennt beide Versionen.

## Capabilities
### New Capabilities
- `oneshots-review-compare`: V1/V2-Vergleich je One-Shot.

### Modified Capabilities
- (keine)

## Akzeptanzkriterien
- **AC1** C öffnet den Vergleich. Die Ansichten Nebeneinander, Schieber und Überblenden lassen sich umschalten. Esc oder C schließt.
- **AC2** Versionsliste: Aktuell, Manifest-Refs, Branches, Datei-Verlauf und eigene Ref. Bei API-Limit bleiben Manifest-Refs und eigene Ref nutzbar.
- **AC3** Andere Version per raw → `srcdoc`, gleiche Herkunft. Element-Markierung funktioniert auf der V2-Seite. Die Markierung speichert ref und SHA.
- **AC4** Scroll-Kopplung beim Nebeneinander. Gerät je Seite wählbar.
- **AC5** Echte Daten: V1 (Pages) gegen V2 (Premium, Commit `bf02f87` oder gepushter Branch) für ein Canvas- und ein CLI-One-Shot. Screenshots aller drei Ansichten, selbst gesichtet.
- **AC6** Link mit `?vergleich=` öffnet dieselbe Ansicht. Das Issue nennt beide Versionen.

## Impact
- `index.html` (Vergleichs-Bühne, Versions-Loader), `manifest.json` (`versions`), README, `.proof/`.
- Koordination: Die Premium-Lane darf `index.html` nicht überschreiben (ihre Galerie soll `gallery.html` heißen).
