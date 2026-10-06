# Desktop visual quality gate — 6 October 2026

**15 🟢 / 0 🔴 after correction.** Each final product screenshot was personally opened and critically inspected. A fresh independent reviewer inspected all fifteen initial final candidates, found eight files needing correction, and subsequently scored every original blocking finding resolved. [Initial review](qa/review-initial.md) · [Correction verdict](qa/review-final.md).

Green means convincing, populated, brand-oriented desktop product demonstration at the inspected scope. It does not certify an exact replica of a particular release, connected-service administration, mobile behavior or a comprehensive accessibility audit. All account names and metrics are illustrative.

| File | Final QG | Screenshot | Concrete assessment |
|---|---|---|---|
| [miro.html](miro.html) | 🟢 | [Miro](screenshots/miro.png) | Complete editor chrome, opportunity map, sticky notes and populated comment threads. |
| [figjam.html](figjam.html) | 🟢 | [FigJam](screenshots/figjam.png) | Pastel journey sections, voting result, team outline and floating bottom tools. |
| [lucidchart.html](lucidchart.html) | 🟢 | [Lucidchart](screenshots/lucidchart.png) | Shapes drawer, formatting ribbon, connected gateway diagram and selected-shape inspector. |
| [whimsical.html](whimsical.html) | 🟢 | [Whimsical](screenshots/whimsical.png) | Smooth mind-map branches, structured task cards and corrected 1-of-6 completion count. |
| [mural.html](mural.html) | 🟢 | [Mural](screenshots/mural.png) | Facilitation controls, agenda, timer and eight voted notes; votes reconcile to 29. |
| [opencodex.html](opencodex.html) | 🟢 | [OpenCodex](screenshots/opencodex.png) | Account pool with real window labels, locked cooldown, coherent activation badges and delegation settings. |
| [cpa-manager-plus.html](cpa-manager-plus.html) | 🟢 | [CPA Manager Plus](screenshots/cpa-manager-plus.png) | Blue management shell, unique traffic profile, six-node health grid, token mix and request table. |
| [magpie.html](magpie.html) | 🟢 | [Magpie](screenshots/magpie.png) | Eight agent-specific model/effort rows, profiles, routing group and provider connections. |
| [easycliproxy.html](easycliproxy.html) | 🟢 | [EasyCLIProxyAPI](screenshots/easycliproxy.png) | Teal desktop console, runtime, three protocol endpoints and correct endpoint-specific copying. |
| [cliproxy-quota-tray.html](cliproxy-quota-tray.html) | 🟢 | [CLIProxy Quota Tray](screenshots/cliproxy-quota-tray.png) | Dark monospace monitor, cost/status panels, provider windows and correctly placed account warning. |
| [cc-switch.html](cc-switch.html) | 🟢 | [CC Switch](screenshots/cc-switch.png) | Blue identity, orange add action, agent tabs, provider activation and dual window bars. |
| [9router.html](9router.html) | 🟢 | [9Router](screenshots/9router.png) | Three-stage routing combo, condition-aware simulator and consistent three-client list. |
| [claude-code-router.html](claude-code-router.html) | 🟢 | [Claude Code Router](screenshots/claude-code-router.png) | Routing rules, context capacity, request stream, transformers and retry configuration. |
| [cliproxyapi-usage.html](cliproxyapi-usage.html) | 🟢 | [CLIProxyAPI Usage](screenshots/cliproxyapi-usage.png) | Distinct token profile, model/account/machine breakdowns, quota windows and matching JSON export. |
| [tokscale.html](tokscale.html) | 🟢 | [Tokscale](screenshots/tokscale.png) | Terminal analytics, 248 observed active days, 18-day streak, empty future dates and matching model/cost totals. |

## Rejections and corrections

- The initial Quota Tray macOS popover interpretation was 🔴 rejected after checking the actual dark Windows/Linux monitor. It was rebuilt with the product’s cost/status/provider layout.
- Initial dashboard screenshots clipping tables/status content were 🔴 rejected as incomplete evidence. Final dashboard captures include the full page.
- The independent review rejected eight candidates for inconsistent demo facts or actions: Whimsical completion count; OpenCodex cooldown/status switching; CPA/Usage/Tokscale export totals; Easy protocol copying; Tray warning placement; 9Router client count/simulation; future-hour graph observations and reused graph data. All listed findings were corrected and rechecked.
- Four charts now use different traffic profiles, terminate at the snapshot time of 16:42 and clearly leave later hours empty. Tokscale also leaves future calendar dates empty.

## Evidence and checks

Capture command: `opencli browser uqsbxvfe screenshot screenshots/<tool>.png --width 1440 --height 1000`; dashboards add `--full-page`. [Exact capture history](screenshots/capture-log.json). Rejected initial screenshots remain in `screenshots/round-1/`.

[Standalone verification](verification.json): all 15 product files have embedded styles/scripts/SVG, no required local asset dependencies, and valid inline JavaScript syntax. [Live browser verification](browser-verification.json): 15 products plus gallery pass rendering and horizontal-overflow checks at 1088px, plus applicable local interaction checks. [Verification boundaries](qa/verification-notes.md).

OpenSpec change `premium-oneshots-20261006` passes `validate --strict`. The [gallery](index.html) links every product and screenshot. [Primary product references](REFERENCES.md) document the source conventions, including five published dashboard images inspected visually.

## Review boundaries

Generic provider/brand SVG marks simplify source logos. Some dashboards share utility chrome, while their working scenes and information hierarchy differ. Canvas tools use common header/minimap primitives with distinct diagrams and workshop geometry. Preview-only edit/settings/navigation feedback is disclosed in README; the screenshots do not establish actual API connectivity. The independent final verdict covers resolution of its original finding list. L13 retains final operator acceptance of the premium visual standard.
