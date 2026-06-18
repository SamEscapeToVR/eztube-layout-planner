# EZTube Layout Planner

A browser-based 3D layout and planning tool for [EZTube](https://www.eztube.com/) modular aluminum framing systems. Drag and drop walls, booth frames, and individual connectors into a room, then export a complete Bill of Materials and cut list — all without installing anything.

![EZTube Layout Planner screenshot](screenshot.png)

## Features

- **3D & top-down views** — orbit, pan, zoom or switch to a locked top-down view
- **First-person walk mode** — drop to eye height and walk the space with `W`/`A`/`S`/`D` or arrow keys (Shift to run), drag to look around; clamps to the room walls
- **Parametric structures** — divider walls, banner/sign frames, and booth frames with adjustable dimensions, connector type, color, and bay count
- **Stage truss** — Global Truss F-series box/triangular/single-tube truss in four configs (goal post, straight span, tower/totem, overhead grid) with automatic standard-segment BOM
- **Wall paint / finishes** — place resizable colored panels (area paint) and stripes (line paint) against any wall, with editable color, height, and opacity; painted area (ft²) and line length (ft) roll up into the BOM
- **RGB spotlights** — drop colored stage-light fixtures under the truss with adjustable beam angle, brightness, reach, and aim; a **Lights** (blackout) toggle dims the room so the colored beams and floor pools show; fixtures roll up into a Lighting & AV gear list
- **Image banners** — upload a JPG/PNG and place it as a sized banner, standing on the floor or hanging from the ceiling/truss (double-sided, adjustable width/height/opacity); images are downscaled on import and printed area (ft²) is tallied for signage quotes
- **Single parts** — place individual connectors (L, T, X4, C3, T3D, W5, W6) and tube segments
- **Space planning** — draw room walls, import a floor-plan image and calibrate its scale
- **Snap & grid** — configurable snap (1″/3″/6″/12″) with live dimension overlays
- **Measure tools** — point-to-point distance and area measurement
- **Planning checks** — aisle clearance, VR buffer zones, tube waste estimates
- **Bill of Materials** — full BOM with part numbers for HF (press-fit), QR (quick-release), and steel series connectors; export as CSV or JSON
- **Cut list** — exact tube lengths per connector inset spec, exportable as CSV
- **Save / load** — layouts save to `localStorage` automatically; export/import as JSON
- **PNG export** — top-down and 3D screenshots
- **Printable report** — print-ready HTML with floor plan image, project summary, and BOM

## Connector systems supported

| Code | System |
|------|--------|
| `HF` | Half-Fit / Press-Fit |
| `QR` | Quick-Release |
| `S`  | Steel series |

Stage truss uses Global Truss F-series specs: **F34** (290 mm 4-chord box), **F44P** (290 mm heavy-duty box), **F33** (290 mm triangle), and **F31** (Ø50 mm single tube). Truss part labels in the BOM are descriptive (e.g. "F34 box truss — 1.0 m straight") — match them against the supplier catalog for exact SKUs.

## Getting started

No build step. Just open `index.html` in a browser:

```bash
git clone https://github.com/YOUR_USERNAME/eztube-layout-planner.git
cd eztube-layout-planner
open index.html   # macOS
# or double-click index.html in Finder / Explorer
```

> **Note:** The 3D connector models are embedded in `eztube-parts.js` (~3.3 MB). On first load the browser parses and caches all meshes — subsequent loads are instant.

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `R` | Rotate selected 90° |
| `D` | Duplicate selected |
| `Del` | Delete selected |
| `M` | Measure distance |
| `A` | Measure area |
| `Esc` | Exit mode / deselect |
| `⌘/Ctrl Z` | Undo |
| `⌘/Ctrl ⇧ Z` | Redo |
| `⌘/Ctrl C / V` | Copy / paste selection |
| `←↑→↓` | Nudge (snap step) |
| `⇧ + arrows` | Nudge 12″ |
| `G` | Group / ungroup |
| `L` | Lock / unlock |

## Repository contents

```
index.html          — app shell and layout
planner-core.js     — Three.js scene, geometry builders, serialization
planner-ui.js       — palette, properties panel, BOM, exports
eztube-parts.js     — base64-encoded GLTF connector meshes (~3.3 MB)
assets/             — original STEP/STP CAD source files for each connector
```

## License

MIT — see [LICENSE](LICENSE).

EZTube is a trademark of its respective owner. This project is not affiliated with or endorsed by EZTube.
