## ADDED Requirements

### Requirement: The overview SHALL list every one-shot prototype automatically
Die Übersicht MUST alle One-Shot-HTML-Dateien des Pages-Branches anzeigen. `manifest.json` liefert Titel, Kategorie und Beschreibung. Dateien, die die öffentliche GitHub-Contents-API zusätzlich meldet, MUST ergänzt werden. Die Übersicht selbst und die Galerie MUST NOT als Prototyp erscheinen.

#### Scenario: Manifest lists all prototypes
- **WHEN** die Übersicht mit einem Manifest von 15 Einträgen geladen wird
- **THEN** zeigt die Liste 15 Prototypen, gruppiert nach Kategorie

#### Scenario: New file without manifest entry
- **WHEN** die GitHub-API eine `.html`-Datei meldet, die nicht im Manifest steht
- **THEN** erscheint sie in der Liste mit ihrem `<title>` als Name und der Kategorie „Neu"

#### Scenario: GitHub API unreachable
- **WHEN** die GitHub-API einen Fehler oder ein Rate-Limit meldet
- **THEN** bleibt die Liste aus dem Manifest vollständig nutzbar und es erscheint keine Fehlermeldung, die die Arbeit blockiert

### Requirement: The overview SHALL preview each prototype at real device widths
Jeder Prototyp MUST in einem iframe mit Geräte-Rahmen laufen. Ein Umschalter MUST die Breiten iPhone 390×844, iPhone 430×932, Tablet 820×1180 und Desktop 1440×900 anbieten. Die iframe-Größe MUST der gewählten Gerätegröße entsprechen; die Darstellung MAY skaliert werden, damit sie in den sichtbaren Bereich passt.

#### Scenario: Switch to iPhone width
- **WHEN** der Betrachter „iPhone 390" wählt
- **THEN** ist `innerWidth` im Prototyp 390 und der Rahmen zeigt ein Telefon

#### Scenario: Selection is kept in the URL
- **WHEN** der Betrachter Prototyp und Gerät wählt und die Seite neu lädt
- **THEN** sind Prototyp und Gerät wieder gewählt

### Requirement: The viewer SHALL mark elements and areas with a note
Im Markier-Modus MUST ein Klick das Element unter dem Zeiger markieren und ein Ziehen einen Bereich. Jede Markierung MUST Tool, Datei, Gerät, Rechteck in Prototyp-Pixeln, Rechteck in Prozent, Scroll-Position, einen Element-Anker und einen Notiz-Text speichern. Gespeicherte Markierungen MUST als Overlay über dem Prototyp sichtbar sein, solange Tool und Gerät passen. Außerhalb des Markier-Modus MUST der Prototyp normal bedienbar bleiben.

#### Scenario: Click marks an element
- **WHEN** der Betrachter im Markier-Modus auf eine Haftnotiz klickt und „Speichern" drückt
- **THEN** entsteht eine Element-Markierung mit Tag, Text und DOM-Pfad der Haftnotiz und einem Rahmen um sie

#### Scenario: Drag marks an area
- **WHEN** der Betrachter im Markier-Modus ein Rechteck zieht und eine Notiz schreibt
- **THEN** entsteht eine Bereichs-Markierung mit genau diesem Rechteck in Prototyp-Pixeln

#### Scenario: Cancel discards the draft
- **WHEN** der Betrachter den Notiz-Dialog mit „Abbrechen" oder Escape schließt
- **THEN** wird keine Markierung gespeichert

### Requirement: Markings SHALL be retrievable
Markierungen MUST in einer sichtbaren Liste stehen, ein Neuladen überleben und als JSON exportiert (Download und Zwischenablage) sowie importiert werden können. Ist der Browser-Speicher gesperrt, MUST die Seite trotzdem funktionieren.

#### Scenario: Export JSON
- **WHEN** der Betrachter „JSON exportieren" drückt
- **THEN** lädt der Browser eine Datei `oneshots-markierungen-<datum>.json` mit allen Markierungen und Schema-Version

#### Scenario: Reload keeps markings
- **WHEN** der Betrachter drei Markierungen anlegt und neu lädt
- **THEN** stehen alle drei wieder in der Liste

### Requirement: Each marking SHALL create a prefilled GitHub issue without a token
Ein Knopf „Issue erstellen" MUST je Markierung und gesammelt je Prototyp einen Link auf `https://github.com/servas-ai/network-canvas-oneshots/issues/new` mit vorausgefülltem `title` und `body` öffnen. Der Body MUST Tool, Link zum Prototyp, Gerät, Koordinaten, Element, Notiz und einen JSON-Block enthalten. Der Code MUST NOT Tokens, Schlüssel oder einen eigenen Server verwenden. Wird der Link zu lang, MUST der Body in die Zwischenablage gehen und der Link nur den Titel tragen.

#### Scenario: Single marking to issue
- **WHEN** der Betrachter bei einer Markierung „Issue erstellen" drückt
- **THEN** öffnet ein neuer Tab das GitHub-Formular „New issue" mit Titel `[Review] <Tool> · <Notiz>` und dem Body der Markierung

#### Scenario: Body too long
- **WHEN** der erzeugte Link länger als 7000 Zeichen wäre
- **THEN** kommt der Body in die Zwischenablage, der Link trägt nur den Titel und ein Hinweis sagt „Body in Zwischenablage, mit Cmd+V einfügen"

### Requirement: The overview SHALL be usable on a phone
Die Übersicht MUST bei 390 px Breite ohne horizontales Scrollen bedienbar sein: Prototyp-Auswahl, Geräte-Umschalter, Markier-Modus, Liste und Issue-Knopf MUST erreichbar sein.

#### Scenario: Open on iPhone
- **WHEN** die Übersicht auf einem 390 px breiten Bildschirm geöffnet wird
- **THEN** sind Auswahl, Geräte-Umschalter, Markieren und die Markierungs-Liste ohne horizontales Scrollen erreichbar
