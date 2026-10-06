## ADDED Requirements

### Requirement: Standalone premium product demonstrations
The suite SHALL contain fifteen self-contained HTML demonstrations with product-specific chrome, populated content, inline SVG icons, consistent tokens, and usable hover and focus states.

#### Scenario: Open a product directly
- **WHEN** a user opens any product HTML without a backend
- **THEN** the complete editor or dashboard renders with realistic illustrative data
- **AND** no secrets or missing local dependencies are required

### Requirement: Evidence-based visual quality gate
Every product SHALL receive a fresh screenshot through `opencli browser uqsbxvfe screenshot screenshots/<tool>.png`, critical visual inspection, and an honest green or red verdict. Failed products MUST be rebuilt or corrected and recaptured before green status.

#### Scenario: Inspect delivery evidence
- **WHEN** L13 opens the quality report
- **THEN** each of the fifteen files has a screenshot and specific visual verdict
- **AND** the report identifies demo data and any fidelity limitations

### Requirement: Discoverable published delivery
The gallery SHALL link all products and screenshots. The change SHALL pass strict OpenSpec validation and be pushed to feat/premium-oneshots with a reviewable serving URL.

#### Scenario: Review the branch
- **WHEN** L13 follows the supplied branch and serving URL
- **THEN** all fifteen products and their quality evidence are accessible
