# Empirata interface and graphics implementation specification

Status: **planning only**. Companion to [roadmap #55](https://github.com/funkatron/empirata/issues/55). No implementation authorized by this document.

## Goals and non-goals
Preserve 1987 Interstel Empire rules and recognizable map semantics while improving touch, inspection, and legibility. Do not modify movement, fog, stacking, selection semantics, AI decisions, or victory rules as a side effect of rendering changes. No faction-specific presentation advantages.

## Decisions to resolve with evidence
| Question | Proposed default | Evidence needed |
|---|---|---|
| Pixel treatment | integer source pixels, nearest-neighbor at every zoom | screenshots at minimum/mid/maximum zoom |
| Terrain | fixed tile atlas with distinct land/water/coast semantics | DOS reference and current terrain inventory |
| Units | transparent sprite above terrain, owner indication independent of color | contrast and stacked-city tests |
| Cities | separate city layer, explicit ownership and production affordance | historical reference and tap inspection |
| Zoomed-out visibility | preserve icons first; test slight overhang only in isolated prototype | overlap, selection, and map readability |
| Selection | stable hit target based on map cell, not painted sprite overhang | pointer/touch regression tests |

These are proposals, not historical-accuracy claims. Record exact DOS evidence and deviations before final artwork approval.

## Layer model
1. Terrain grid, pixel-aligned.
2. Fog/visibility overlay, respecting existing engine visibility.
3. City markers, without obscuring owner or fog.
4. Unit sprites, with owner and selected-state treatments.
5. Selection/focus indicators and interaction overlays.

No rendering layer may disclose hidden information. A cell's click/tap hitbox remains the cell even if a zoomed-out sprite visually extends beyond it.

## Zoom and pixel sharpness
- Specify one canonical source sprite size and anchor for each tile type before implementation; do not assume current sprite dimensions.
- Use nearest-neighbor sampling and consistent pixel alignment; avoid fractional-source-pixel interpolation.
- Review three explicit states: full-map overview, normal play, and maximum zoom.
- At full-map overview, test icon overhang as an **optional A/B variant**, with a bounded maximum and stable anchors. Reject if adjacent units merge visually or the apparent tap target becomes misleading.
- At maximum zoom, inspect sprite silhouettes and hard edges, especially diagonal outlines and transparent borders.
- Include device-pixel-ratio 1 and 2+ checks; verify browser canvas/image smoothing configuration.

## City and stack interaction
**Entry:** tap/click a cell containing a city and multiple inspectable entities.

**Presentation:** selection sheet/popover listing city first, then units in a stable order. Each row identifies entity type, display name, owner and relevant status; never expose internal IDs as user-facing labels. Mark current selection clearly.

**Behavior:** selecting a row inspects that entity only. Dismiss, Escape, and outside-tap close without issuing movement orders. Observer AI-vs-AI mode is inspect-only. Preserve keyboard focus and accessible names. Keep the sheet usable on a narrow touch viewport.

**Cases:** empty city, city with one unit, mixed stack, very large stack, allied/enemy visibility restrictions, fog, captured city, AI-vs-AI observer, mouse, keyboard and touch. Verify a double-tap cannot accidentally issue an order.

## New-game and observer flows
- Explicit human-vs-computer and computer-vs-computer mode selection.
- Benchmark maps labeled with purpose and, where applicable, asymmetry; do not imply a benchmark map is balanced without evidence.
- Verify chosen map and faction are actually passed to engine setup.
- Observer: clearly indicate both AI players, active turn, batch progress and victory; allow inspection without modifying play.

## Asset inventory to complete before coding
| Category | Needed |
|---|---|
| Terrain | enumerate actual terrain IDs and transitions from engine |
| Units | enumerate actual unit IDs, sprite anchors, ownership marks |
| Cities | owned/neutral/contested visual states supported by rules |
| Fog | unexplored versus explored-but-not-currently-visible states |
| States | selected, focused, stacked, embarked, damaged where available |

## Execution packets
### G1: Reference and inventory (docs-only)
1. Capture current screenshots at minimum, middle and maximum zoom on iPad and desktop.
   - **On main (merged [PR #57](https://github.com/funkatron/empirata/pull/57)):** `smoke/map-screenshots.mjs` captures full-page WebKit shots (`01-fit-world`, `02-normal`, `03-zoomed-in`, `04-invasion`) with a manifest; CI workflow `.github/workflows/map-screenshots.yml` runs on PRs that touch the harness (Playwright **1.65.0**, `ubuntu-latest`). Artifacts are human-review baselines, not pixel gates. **Still open:** iPad portrait/landscape viewports, `devicePixelRatio` 2+, and explicit maximum-zoom vs fit-world separation on hardware.
2. Obtain legally usable 1987 DOS Empire screenshots; record version/source and uncertainties.
3. Extract actual terrain/unit/city enum names and existing render paths (see `src/ui/map-art.ts`, `src/ui/main.ts` `paint()` layering).
4. Produce side-by-side annotated comparison and a sprite specification table.
**Completion:** source-backed asset inventory and approved visual direction, no invented DOS details.

### G2: Rendering sharpness (small isolated PR)
Implement only pixel sampling/alignment adjustments identified by G1. Snapshot tests at three zoom levels, device-pixel-ratio checks, no gameplay changes.
**Completion:** no blurry edges or sprite clipping, CI and Copilot reviewed.

### G3: Overview visibility experiment (optional)
Prototype bounded icon overhang at minimum zoom behind a flag. Compare baseline versus variant on dense maps, coasts and mixed stacks. Keep hitboxes unchanged. Reject if overlap or ownership ambiguity worsens.
**Completion:** screenshot evidence and explicit keep/revert decision.

### U1: City stack selector
Implement city-first list and unit inspection, including touch and keyboard dismiss behavior. Add deterministic interaction tests for all listed cases.
**Completion:** selecting a row never issues a move; observer remains inspect-only.

### U2: New-game and observer audit
Check mode/map selection, batching, inspection, progress, and victory presentation against existing implementation; fix only demonstrated gaps.
**Completion:** documented iPad and desktop manual walkthrough plus automated coverage for core flows.

## G1 capture protocol and evidence ledger (ready for execution)

Use one pinned commit and one fixed save/map for all comparisons. Record the commit SHA, browser/device, viewport CSS dimensions, device-pixel ratio, map ID/seed, faction viewpoint, zoom value, and whether fog is enabled. Do not compare different game states as though they were a zoom A/B test.

| Capture | Zoom | Scene | What to inspect |
|---|---|---|---|
| A | full-map minimum | same saved state | icons distinguishable, ownership, coasts, fog, crowded cells |
| B | ordinary play / midpoint | same saved state and center | source pixel sharpness, sprite anchors, labels |
| C | maximum | same saved state and center | diagonal edges, transparency, clipping, canvas smoothing |
| D | minimum, dense area | fixed crowded stack/coast | overlapping silhouettes and selection hitbox |

Repeat A–C on desktop and iPad, and explicitly record any unavailable device capture rather than treating it as passed. Capture at DPR 1 and DPR 2+ where practical. For each image, record the corresponding file or artifact URL; screenshots alone do not establish historical fidelity.

**Rendering inventory worksheet:** module path + function, drawing surface (canvas/DOM/image), terrain enum and asset source, unit enum and sprite source, city marker states, tile dimensions in source pixels, scaling formula, smoothing settings, render order, fog handling, hit-testing path, and known discrepancies. Mark unverified fields `unknown`, never inferred.

**1987 comparison worksheet:** reference URL/rights, exact game version if known, image resolution and zoom, observed palette/silhouette/terrain/city convention, confidence, and whether the proposal is faithful, adapted for legibility, or unresolved. Avoid claiming equivalence across unknown DOS versions.

**G1 exit checks:**
- [ ] Pin baseline commit and saved state; record capture metadata.
- [ ] Locate rendering and hit-testing entry points by actual source inspection.
- [ ] Fill terrain/unit/city enum and sprite-size inventory with code references.
- [ ] Capture A–C on desktop and iPad; document any unavailable checks.
- [ ] Obtain attributable DOS references and annotate similarities/differences.
- [ ] Record one recommended smallest G2 change, or explicitly conclude none is justified.

No implementation, merge, or deployment is implied by completing this worksheet.

## PR evidence template
- Problem and screenshot/reproduction:
- Baseline behavior and pinned SHA:
- Proposed smallest change / explicit exclusions:
- Visual references and historical confidence:
- [ ] Focused tests
- [ ] Three-zoom screenshots
- [ ] iPad touch check
- [ ] Desktop keyboard/mouse check
- [ ] No fog or rules regression
- [ ] CI passing
- [ ] Copilot review addressed
- Release impact: semver milestone only if meaningful; build timestamp/SHA separate.
- Merge/deploy: require explicit authorization and independently verify deployment.

## Dependencies and next action
G1 screenshot automation is on `main` (#57); extend it before claiming G1 complete on all viewports. Saved-game replay Action is on `main` (#53). G2 depends on G1 inventory sign-off; G3 depends on G2; U1 can proceed independently (`#stackDialog` exists—audit against U1 cases). Next step: **DOS reference captures + render-path inventory table**, then G2 sharpness PR. Keep this document updated; link implementation PRs here and to #55.


## G1 source inventory (verified against main `3e3ef1038f64f7dc3493139044e68ee971f7e4f1`)

| Concern | Source and observed implementation |
|---|---|
| Engine terrain | `src/engine/types.ts`: `Terrain = 'land' | 'sea'`; unexplored player-view terrain is `null`. No additional terrain enum is established. |
| Unit classes | `src/engine/types.ts`: army, fighter, destroyer, transport, submarine, cruiser, carrier, battleship (8). |
| Terrain art | `src/ui/map-art.ts`: procedural 32×32 canvas stamps, four deterministic variants each for land and sea, drawn with `drawImage` at current tile size plus 0.25 px. Coast edges are vector strokes and corner bevels. |
| Unit/city art | `src/ui/map-art.ts`: eight `Path2D` unit silhouettes in a 24-unit coordinate system; city and harbor `Path2D` symbols. Stroke plus fill, scaled by `size/24`. No external sprite atlas is used in this path. |
| Render entry and ordering | `src/ui/main.ts` `paint()`: terrain → coast → explored fog overlay → grid → city → one representative unit per occupied cell → stack count → selection outline. Stale contacts use reduced alpha and a raster compositing layer in `map-art.ts`. |
| Canvas and DPR | `src/ui/main.ts` `resize()`: backing dimensions use `floor(client dimension × devicePixelRatio)`, transform set to DPR. No explicit `imageSmoothingEnabled` assignment found in these two inspected modules; verify browser defaults and behavior experimentally. |
| Zoom | `src/ui/main.ts`: initial tile size 30 CSS px; `zoom()` clamps to world-fit minimum and 45 CSS px maximum; `fitWorld()` fits 100×60 world to canvas. Icons already scale up at overview via `fitWeight`, with isolated units receiving a larger adjustment. This is existing behavior, not a proposed new feature. |
| City/stack layout | `paint()`: city icon size .44 tile when stacked, .74 otherwise; unit scale .66 on city or .82 plus overview adjustment elsewhere. Counts are drawn only at tile size ≥20. |
| Hit-testing | `src/ui/main.ts` `cellFromPointer()`: floor of pointer CSS coordinates plus camera offset divided by tile size. Hitbox is grid cell, independent of icon overhang. |
| Existing stack selector | `src/ui/main.ts` `showCityStack()`: already provides a city-first dialog with unit choices. Further U1 work must audit gaps rather than reimplement this feature. |

### G1 findings and bounded first candidate

**Observed:** terrain is a raster 32×32 stamp but unit/city silhouettes are vector paths. Therefore nearest-neighbor sampling alone cannot guarantee sharp pixel-art edges for all elements. Fractional tile coordinates, vector scaling, coastline strokes, and `size+.25` terrain overlap need separate visual inspection before any change.

**Candidate G2 hypothesis (not yet validated):** controlling raster sampling and pixel alignment at integer zoom factors may improve terrain sharpness without changing game logic. **Do not** globally disable smoothing or snap all positions before screenshot A/B: vector outlines and fractional full-map fit may degrade. First capture the current state at fit, normal, and maximum zoom; then isolate one rendering adjustment and compare.

**Remaining unknowns:** screenshots on desktop/iPad and DPR 1/2+, actual CSS sizing/resize behavior across devices, attributable DOS references, visual evidence of blur/clipping, and whether a rendering adjustment is warranted. These are not marked complete.

## Reusable browser screenshot testing: verified starting point

The repository already contains a real-browser Playwright smoke test at `smoke/observer.mjs`, so a new browser framework is unnecessary. It launches **WebKit**, serves built `dist/` assets through a local ephemeral HTTP server, uses a **1024×1366** viewport, checks observer behavior, and optionally saves `observer-progress-portrait.png` when `EMPIRATA_SCREENSHOT_DIR` is set. `package.json` exposes `npm run test:observer` (build then smoke test). The Playwright module is loaded dynamically, and the smoke-test header explicitly states browser downloads are optional for normal CI. This is confirmed source behavior, **not** evidence that a GitHub Actions screenshot job currently runs.

**Recommended reusable extension, separate from the docs-only G1 packet:**
1. Add a dedicated opt-in browser capture command that reuses the existing static-server and Playwright approach. Do not run browser downloads in ordinary unit-test CI.
2. Load a fixed deterministic scenario or saved state, disable animation and wait for stable rendering, and capture minimum/normal/maximum zoom plus a crowded coast/stack scene. Record commit, map seed, viewport, DPR, browser engine, zoom and viewpoint in a JSON manifest alongside PNG files.
3. Add a manually dispatched GitHub Actions workflow with pinned Node 24 and Playwright/browser versions; upload PNGs and manifest as a retained Actions artifact, including on test failure. Do not assume iPad Safari parity from desktop WebKit; actual iPad touch testing remains separate.
4. Later use these captures for visual regression review with explicit, reviewed thresholds and masks for nondeterministic UI. Do not make pixel-diff failures a default CI gate until a stable baseline exists.

**Status:** existing WebKit screenshot capability confirmed in source; four-scene zoom capture, workflow, artifact retention, and actual screenshot output **not yet implemented or verified**.
