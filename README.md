# Premium product one-shots

Fifteen original, self-contained HTML product UI studies: five collaborative canvas editors and ten CLI management/analytics tools. Each HTML embeds its styles, inline SVG geometry/icons, example content and local preview interactions. No backend or keys are required.

Open [the gallery](index.html), [the visual quality report](QG.md), or [the product references](REFERENCES.md).

**Functional surface (SERVAS-2071):** see [LIVE.md](LIVE.md) — real local usage/quota dashboard plus the shared `shared/` component layer.

## Run locally

```sh
python3 -m http.server 8873
```

Open http://localhost:8873/. Product files also work directly as standalone files; clipboard access may require localhost or HTTPS.

## Evidence

- `screenshots/<tool>.png`: final desktop evidence, captured using `opencli browser uqsbxvfe screenshot`.
- `screenshots/round-1/`: rejected initial evidence, retained for audit.
- `screenshots/capture-log.json`: capture commands and timestamps.
- `verification.json`: single-file dependencies and JavaScript syntax checks.
- `browser-verification.json`: live rendering/overflow and selected local interaction checks.
- `qa/`: independent visual review findings and correction verdict.
- OpenSpec change: `premium-oneshots-20261006`.

## Scope

The screenshots depict illustrative accounts, traffic, costs, quotas and collaborative work. Local preview interactions include provider activation, tool/gallery filtering, model selects, chart/routing simulation, theme changes, canvas note creation/dragging/zoom, timers, refresh feedback, endpoint copying and page-specific JSON export. Edit/configuration/navigation actions outside the demonstrated scene provide preview feedback; no live provider administration is implied. Desktop is the quality-gate scope.
