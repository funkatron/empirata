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
2. Obtain legally usable 1987 DOS Empire screenshots; record version/source and uncertainties.
3. Extract actual terrain/unit/city enum names and existing render paths.
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
G1 and U2 are safe to investigate while replay PR #53/#54 is pending. G2 depends on G1; G3 depends on G2; U1 can proceed independently. Next step is **inventory and screenshots**, then fill in exact module names and asset dimensions rather than guessing them. Keep this document updated when decisions change; link implementation PRs back here and to #55.
