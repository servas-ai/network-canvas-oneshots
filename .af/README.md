# One-Shots Pages deployment

SERVAS-2058 retains the existing public gallery at https://servas-ai.github.io/network-canvas-oneshots/.

Source reviewed independently: `0b1ee7c38c600b41dc47114ce2875f1f6c0fd4ed`, implementation PR #1, target branch `feat/canvas-oneshots`. Existing content, GitHub comparison and optional voice integration remain as requested by the owner. This release adds no new brand or public endpoint.

Build on the desk with Node 24.21.0: `npm ci && npm run validate && node scripts/prepare-pages.cjs`. The versioned `docs/` artifact contains the complete minified `dist/`, `.nojekyll`, and SHA256 `build-hashes.json`. No GitHub Actions workflow is added.

Release must first merge the dedicated release-gate declaration PR into `feat/canvas-oneshots`. It supplies `.af/gate` and `scripts/release-gate.cjs` for integrated testing of older PRs. Then review and merge PR #1, followed by the deployment artifact PR. The gate checks the static baseline, then on a build-enabled stand runs Node 24.21.0 HTML validation and two complete builds, comparing all SHA256 hashes; when `docs/` exists it also verifies the entire publication artifact, manifest and absence of extra files. Deployment may then change the existing legacy Pages source path from `/` to `/docs`, retaining its branch and URL. Use the shared branch lock for merge/settings changes. Do not record CP5 as complete until HTTPS returns the exact published artifact; GitHub Pages build completion alone is insufficient. Independent CP6 includes live mobile Lighthouse, WebGPU and Canvas2D, deep links and iframe input.

Pre-release Pages configuration: legacy, branch `feat/canvas-oneshots`, path `/`, HTTPS enforced, no custom domain. Last published source: `8500044408a19001849acd6d86a20313815e59ac`. Preserve this commit as the rollback reference. Before changing settings, read them again to detect concurrent updates.

Rollback: restore the Pages path `/` for a settings-only failure. For a functional regression after PR #1, create a reviewed revert PR restoring the previous source content from `8500044408a19001849acd6d86a20313815e59ac`, then publish from `/`. Do not reset or force-push the shared branch. Confirm HTTPS and iframe input after rollback.

CP5 and CP6 remain open until live evidence is recorded. Deployment preparation and local hashes are not live acceptance.
