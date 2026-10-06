# Verification scope

- Final screenshots: desktop 1440px wide, 1000px viewport; full-page dashboards. Every product was visually opened and inspected by the implementation agent and a fresh independent reviewer.
- Initial review: seven visual greens, eight files requiring corrections. Final correction verdict: all original blockers resolved; ship at the correction-list scope. This does not assert a fresh full accessibility audit.
- Live iframe checks: all fifteen products plus gallery rendered at 1088×818; no document horizontal overflow, SVG presence and image loading passed. Applicable provider activation, cooldown lockout/status synchronization, tool filtering, note creation, zoom, theme toggles, protocol-specific copying, route simulation and page-specific export values passed.
- JavaScript syntax: node --check passed on each product inline script. No product depends on separate local CSS/JS/assets.
- OpenSpec strict validation passed before implementation and after corrections.
- Impeccable mechanical detector ran once. Its HTML parser modules were unavailable, so it used degraded regex mode. It flagged native/system typography plus one rounded-accent-border and one dark-glow heuristic. Native type and actual product operational conventions were retained. No computed contrast, mobile, screen-reader or connected-backend acceptance is claimed.

Reproduce captures with a local server on port 8873, then `python3 qa/capture.py`. Run standalone checks from repository root using `python3 qa/check-standalone.py`. `qa/browser-check.js` is the live same-origin iframe check used through opencli eval; it validates local preview behavior without calling provider APIs.
