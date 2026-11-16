# G1 OODA plan — pinch / pan / tap regression (2026-11-16)

Parent: [P4 Priority 1 audit](p4-priority1-audit.md) gap **G1**. Roadmap acceptance: [§1 touch zoom, pan, fit](../docs/ROADMAP.md#1-touch-zoom-pan-and-fit-entire-world) bullets 1–2 (+ shared bounds via existing `camera.ts`).

## Observe (facts)

### Current implementation (`src/ui/main.ts`)

| Concern | Mechanism |
|---------|-----------|
| Two-touch detection | `Map<pointerId, {x,y}>`, `pinchPoints()` midpoint + `Math.hypot` distance (min 1) |
| Pinch start | `beginPinch()` stores `{distance, scale: tileSize, worldX, worldY}`; sets `suppressTap`, clears `down` |
| Pinch move | `tileSize = clampTileSize(scale * newDist / startDist, …)`; camera from anchored world point |
| World anchor | `worldX = (midX - rect.left + cameraX) / tileSize` (same for Y) |
| Single-finger pan | `down` snapshot; move if `|dx|+|dy| > 6` → update camera |
| Tap | `pointerup` with `!moved && !cancelled` → `tapTile` |
| Pinch / multi-touch end | `finishPointer` clears pinch; **no tap** while `pinch \|\| suppressTap` |
| 3+ fingers | `suppressTap = true`, no pan/tap |
| Bounds | `clamp()` on camera after pinch/pan (depends on live `canvas` + `game` size) |

**No** automated tests cover gesture direction, anchor stability, pan threshold, or tap suppression. **`src/ui/camera.ts`** already holds `clampTileSize` / `fitTileSize` (tested in `tests/ui-camera.test.mjs`).

### Tests today

- `ui-camera.test.mjs` — fit/clamp/max tile size only  
- `ui-structure.test.mjs` — DOM ids, not behavior  
- Playwright pinch — **not** in default CI; high cost (G6)

### Constraints

- **Behavior-neutral** refactor preferred: extract pure math, wire `main.ts` to use it (same formulas).  
- **No new gameplay** or engine changes.  
- **Default CI** must stay fast — Node unit tests only for G1 core; Playwright is optional **G1b**.  
- Pinch **direction** convention in app: **fingers spread** → distance ↑ → **zoom in** (larger `tileSize`).

## Orient (risks and options)

| Approach | Pros | Cons |
|----------|------|------|
| **A. Pure helpers in `src/ui/gestures.ts`** (recommended) | Same pattern as `camera.ts`; deterministic; runs in `npm test` | Does not catch DOM/event bugs |
| **B. Playwright two-pointer simulation** | End-to-end on real canvas | Slow, flaky, stays opt-in |
| **C. Inline tests in `main.ts`** | None | Untestable; violates project pattern |

**Decision:** **A required**, **B optional** follow-up PR if product wants E2E proof.

**Out of scope for G1**

- Overview-scale tap policy (G4)  
- a11y (G3)  
- Changing 6px pan threshold or pinch min-distance without parity review  
- Camera `clamp()` extraction (can test indirectly via gesture output + separate clamp tests later)

## Decide (API and PR scope)

### New module: `src/ui/gestures.ts` (names tentative)

| Function | Purpose |
|----------|---------|
| `pointerPairMidpoint(a, b)` | `{x, y}` client coords |
| `pointerPairDistance(a, b, min = 1)` | Pinch span |
| `pinchWorldAnchor(midX, midY, rectLeft, rectTop, cameraX, cameraY, tileSize)` | `{worldX, worldY}` at gesture start |
| `pinchFrame(input)` | Given anchor + start distance/scale + current midpoint/distance + viewport/world dims → `{tileSize, cameraX, cameraY}` using **`clampTileSize`** only (no canvas clamp) |
| `panCamera(startCam, dx, dy)` | `{cameraX, cameraY}` for one-finger drag |
| `exceedsPanThreshold(dx, dy, threshold = 6)` | Boolean |
| `shouldEmitTap({cancelled, moved, suppressTap, pinchActive})` | Boolean |
| `shouldBeginPinch(touchCount)` | `touchCount === 2` |

`pinchFrame` must mirror today's lines 637–660:

```ts
tileSize = clampTileSize(startScale * currentDistance / startDistance, viewW, viewH, worldW, worldH);
cameraX = worldX * tileSize - (midX - rectLeft);
cameraY = worldY * tileSize - (midY - rectTop);
```

### Refactor `main.ts`

- Import helpers; replace inline math in `beginPinch`, `pointermove` (pinch branch), pan threshold, `finishPointer` tap guard.  
- Keep `clamp()` call **after** frame apply (DOM-specific).  
- **No** change to `tapTile` or game dispatch.

### Tests: `tests/ui-gestures.test.mjs`

| Test | Maps to acceptance |
|------|---------------------|
| Spread distance 100→200 doubles effective scale factor (before clamp) | 1.1 zoom direction |
| Midpoint fixed, scale change → world point under midpoint stable in CSS space | 1.1 anchor |
| Midpoint moves, distance constant → camera shifts (pan-in-pinch) | 1.1 pan during pinch |
| `exceedsPanThreshold(3,3)` false; `(4,4)` true | 1.2 pan vs tap |
| `shouldEmitTap` false when `moved`, `suppressTap`, or ending pinch | 1.2 no accidental select |
| `pinchFrame` respects `clampTileSize` floor at extreme pinch-out | ties to 1.4 with `ui-camera` |

**Success criteria (G1 done)**

- All new tests green; **432+** existing tests unchanged.  
- `agents/p4-priority1-audit.md` G1 row → **Pass** (unit) or **Pass (pure math); E2E optional**.  
- Audit doc + roadmap P4 can close when owner accepts unit-level proof.

### PR

- Single branch: `cursor/p4-g1-gestures-85b7`  
- Commit order: (1) `gestures.ts` + tests, (2) `main.ts` wire-up.  
- `npm run build` + `npm test`; **no** browser required for merge if tests pass.

### Optional G1b (separate)

- `smoke/gestures-playwright.mjs` + workflow_dispatch only if manual pinch still insufficient.

## Act (steps)

1. Pull `main`; branch `cursor/p4-g1-gestures-85b7`.  
2. Implement `gestures.ts` with types for rect/viewport inputs.  
3. Add `tests/ui-gestures.test.mjs` (red → green against helpers before wiring).  
4. Wire `main.ts`; run full suite.  
5. Update `p4-priority1-audit.md` G1 + mark P4 item 8 testable paths in `TEST_STRATEGY.md` (one line).  
6. PR; merge when verify green.

## Verify locally

```bash
npm run build
node --test tests/ui-gestures.test.mjs
npm test
```