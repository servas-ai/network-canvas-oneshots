# Network Canvas One-Shots

A collection of **5 high-fidelity, self-contained single-file HTML one-shot prototypes** modeling the top proprietary whiteboard and visual diagramming platforms:

1. **Miro** (`miro.html`)
2. **FigJam** (`figjam.html`)
3. **Lucidchart** (`lucidchart.html`)
4. **Whimsical** (`whimsical.html`)
5. **Mural** (`mural.html`)

Each prototype is completely self-contained in a single `.html` file with inline CSS and JavaScript. No build step, no npm packages, and no external bundlers required.

---

## 📊 Vision Quality Gate (QG) Matrix

Tested and verified via `opencli browser screenshot` (sanctioned browser bridge, non-headless):

| Tool | File | Features & Interactions | Vision QG Status |
| :--- | :--- | :--- | :---: |
| **Miro** | [`miro.html`](./miro.html) | Infinite pannable/zoomable canvas, frames, colored stickies (yellow/green/pink/blue) with drag & drop, collaborator live cursor, left tool palette, zoom controls & minimap toggle. | 🟢 **PASS** |
| **FigJam** | [`figjam.html`](./figjam.html) | Playful Figma aesthetic, floating bottom dock, sticky notes with author chips, interactive click-to-count stamps (👍, 🔥, 💯), section containers, organic curved connectors. | 🟢 **PASS** |
| **Lucidchart** | [`lucidchart.html`](./lucidchart.html) | Enterprise grid canvas, top menu & formatting ribbon, left shape dock (Terminator, Process, Decision, Data), right property inspector, draggable nodes with orthogonal elbow connectors. | 🟢 **PASS** |
| **Whimsical** | [`whimsical.html`](./whimsical.html) | Minimalist high-velocity canvas, mode switcher (Flowchart/Wireframe/Mind Map), hierarchical cards with status tags (Done/Active/Queue), smooth branching bezier trees, draggable cards. | 🟢 **PASS** |
| **Mural** | [`mural.html`](./mural.html) | Facilitator Superpowers bar (active countdown timer with pause/start, voting, celebration), left tools dock, right session agenda outline, 2x2 matrix template, stickies with voting dots. | 🟢 **PASS** |

---

## 🚀 How to Run

Simply open any of the HTML files directly in your web browser:

```bash
open miro.html
open figjam.html
open lucidchart.html
open whimsical.html
open mural.html
```

Or serve them with any static web server:

```bash
python3 -m http.server 8080
```

---

## 🛠️ Architecture & Principles

- **Zero External Dependencies**: Standalone HTML + CSS + Vanilla JS.
- **Interactive Drag & Pan**: Pointer events supporting smooth canvas navigation (drag to pan, mouse wheel to zoom, drag cards/stickies).
- **Faithful Design Systems**: Accurately reproduces the typography, color palettes, border radii, iconography, and distinctive brand elements of each tool.
- **OpenSpec Verified**: Tracked under change `canvas-oneshots-20261006`.
