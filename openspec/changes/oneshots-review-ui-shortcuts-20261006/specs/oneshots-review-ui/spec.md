## ADDED Requirements

### Requirement: The overview SHALL use a token-based design system
All colors, spacings, radii, font sizes and shadows of the review overview MUST come from CSS custom properties defined on `:root`. Components MUST NOT hard-code colors outside the token blocks.

#### Scenario: Tokens drive the look
- **WHEN** the stylesheet is inspected
- **THEN** hex colors appear only inside the light and dark token blocks (and the browser-frame traffic lights)
- **AND** spacing values use the 4 px scale tokens

### Requirement: The overview SHALL offer light, dark and automatic theme
The viewer MUST be able to switch between Auto (system), Hell and Dunkel with a header button and the key T. The choice MUST survive a reload in the same browser and MUST fall back to Auto if storage is blocked.

#### Scenario: Switch theme by key
- **WHEN** the viewer presses T twice starting from Auto
- **THEN** the page shows Hell, then Dunkel
- **AND** after a reload the page is still Dunkel

### Requirement: The overview SHALL provide keyboard shortcuts
The overview MUST react to M (markieren), I (Issue), N/P (nächstes/voriges One-Shot), 1–4 (Gerät), / (Suche), ? (Übersicht), T (Thema) and Esc (schließen). Shortcuts MUST NOT fire while the viewer types in an input, textarea, select, contenteditable element or the note dialog, and MUST also work while focus is inside the prototype iframe.

#### Scenario: Navigate and switch device by key
- **WHEN** the viewer presses N, then 4
- **THEN** the next prototype in list order is shown in Desktop 1440

#### Scenario: Issue by key
- **WHEN** a marking card is selected and the viewer presses I
- **THEN** the prefilled GitHub issue link for that marking opens

#### Scenario: Typing does not trigger shortcuts
- **WHEN** the viewer types "n1m" in the search field
- **THEN** the prototype, device and marking mode stay unchanged

#### Scenario: Focus inside the prototype
- **WHEN** the viewer clicked into the prototype and presses 2
- **THEN** the device switches to iPhone 430

### Requirement: The overview SHALL show its shortcuts
Pressing ? or the keyboard button MUST open an overview listing every shortcut. Buttons with a shortcut MUST name the key in their tooltip.

#### Scenario: Shortcut overview
- **WHEN** the viewer presses ?
- **THEN** a dialog lists M, I, N, P, 1–4, /, T, V, C, ? and Esc with their meaning
- **AND** Esc closes it
