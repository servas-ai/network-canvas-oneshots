## ADDED Requirements

### Requirement: The overview SHALL compare two versions of a one-shot
Pressing C or the compare button MUST open a compare view for the current one-shot with the modes Nebeneinander, Schieber and Überblenden. Each side MUST show a version and a device of its own. Esc or C MUST close the view.

#### Scenario: Slider compare
- **WHEN** the viewer opens the compare view in mode Schieber and drags the divider to 30 %
- **THEN** the left 30 % shows version A and the rest shows version B at the same device size

#### Scenario: Side by side with synced scroll
- **WHEN** both sides show iPhone 390 and the viewer scrolls side A
- **THEN** side B scrolls to the same position while sync is on

### Requirement: Versions SHALL come from the repository without a token
The version list MUST offer the current Pages file, refs listed in `manifest.json` `versions`, the repository's branches and the file's commit history (public GitHub API, cached), and a free ref input. Other versions MUST load from `raw.githubusercontent.com` into a same-origin `srcdoc` frame. If the API is rate-limited, manifest refs and the free ref MUST still work.

#### Scenario: Premium version
- **WHEN** the viewer picks ref `bf02f87` for `miro.html`
- **THEN** side B renders the premium Miro mock-up from that commit

### Requirement: Markings SHALL record the version
A marking made in the compare view MUST store the version ref and short SHA of its side. The issue text MUST name that version, and a compare issue MUST name both versions.

#### Scenario: Marking on V2
- **WHEN** the viewer marks an element on side B (ref `feat/premium-oneshots`)
- **THEN** the saved marking carries that ref, and the prefilled issue says "Version: feat/premium-oneshots"
