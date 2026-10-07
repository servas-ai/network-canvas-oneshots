# SERVAS-2058 verification

- `npm run validate`: html-validate 10.1.0, exit 0, zero errors in viewer index.html (previously 13).
- Local static links/resources and all 15 manifest targets exist: reports/html-validation.json.
- `npm run build`: all 17 HTML pages, inline CSS/JS and stage renderer minified into dist; assets copied. Two builds have identical full SHA256 manifests (cmp exit 0).
- Lighthouse 13.0.1 mobile, bcli cloud, HTTPS resources routed from dist: fresh session Performance 75, Accessibility 100, TBT 889.5 ms, CLS 0.000866. A warm-session run reached 99/100 with TBT 0 ms. The first GPU use remains costly, so CP4 does not meet Performance >= 90 reliably. Current JSON/HTML reports show the fresh-session result. This is a development measurement, not deployed-page verification; GitHub discovery is isolated.
- Renderer color readback uses a CPU canvas (`willReadFrequently`) to avoid GPU synchronization; preview stays hidden until its initial device geometry is fitted.
- Browser functional test covers WebGPU, forced Canvas2D, device loss, missing navigator.gpu, iframe interaction, resize, rotation, 1:1, reduced motion and deep link. See webgpu-browser.json.
- Existing GitHub discovery/version requests and optional voice bridge remain product features. Therefore the strict whole-site “no external requests” part of CP3 is not met; the new renderer has no external dependencies.
- PR targets feat/canvas-oneshots, the current Pages source. No merge/deployment by this role; CP5 and independent acceptance CP6 remain open.
