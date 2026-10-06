SERVAS-2058 verification

- Served the current repository to the bcli cloud browser by intercepting requests on the HTTPS Pages origin. This tests local PR code, not the deployed website.
- Real WebGPU adapter/pipeline: `webgpu`; forced fallback: `canvas2d`.
- Destroyed the acquired GPUDevice: automatic transition to a fresh Canvas2D surface.
- Removed navigator.gpu before navigation: Canvas2D fallback.
- Miro deep-link, iframe click/focus, rotate, 1:1 toggle, mobile resize, dark theme and reduced motion checked; no page errors.
- `node --check` for source, minified module and test; `git diff --check`: exit 0.
- New module minified with pinned terser 5.44.0. Existing HTML/CSS publishing workflow remains static.
- html-validate 10.1.0: 13 existing errors on both baseline and changed viewer; 0 new errors. Whole-page HTML validation therefore remains open.
- Lighthouse not measured. No deployment or independent acceptance performed.

Reproduce with the README command and a newly created bcli cloud session. `webgpu-browser.json` contains machine-readable results; screenshots are attached to the Multica delivery.
