# Priority 1 acceptance audit (P4 Phase 0)

**Date:** 2026-11-16 (ET). **Branch baseline:** `main` after P3. **Scenario exercised:** Close Quarters (autosave), round 2.

**Evidence artifacts:** `/opt/cursor/artifacts/p4-audit-{desktop,game-menu,fit-world-desktop,ipad-portrait-fit}.png` (browser audit run).

## Executive summary

| Area | Result |
|------|--------|
| Fit world + toolbar | **Pass** (desktop 1024×768, iPad portrait 834×1194) |
| Game menu placement + scenario migration | **Pass** (structure tests + screenshots) |
| Sidebar scope (no scenario starts) | **Pass** |
| Pinch / gesture safety | **Partial** — code review only; no automated proof |
| Accessibility (Escape, focus, SR) | **Partial** — labels on map buttons; menu close gaps (see below) |
| CI browser confidence | **Partial** — default verify has bundle smoke only |

**Recommendation:** Proceed to **Phase 1** with a **narrow** gap list (below); do not treat Priority 1 as fully closed until gesture tests or Playwright evidence exists.

---

## Touch zoom, pan, fit (roadmap §1)

| # | Acceptance criterion | Status | Evidence |
|---|----------------------|--------|----------|
| 1.1 | Pinch inward = zoom out, spread = zoom in; anchor stable | **Pass (unit)** | `src/ui/gestures.ts` + `tests/ui-gestures.test.mjs`; wired from `main.ts` |
| 1.2 | Pan without order; tap selects; 2-finger never attacks | **Pass (unit)** | `exceedsPanThreshold`, `shouldEmitTap`, `panCamera` tests |
| 1.3 | Fit world shows full 100×60 on iPad + phone viewports | **Pass** | `ui-camera.test.mjs`; screenshots after ⊞ |
| 1.4 | Zoom bounded, no NaN after resize | **Partial** | `clampTileSize` tests; resize path **untested** in browser |
| 1.5 | +/-, wheel, keyboard zoom still work | **Partial** | Code: `zoom()`, `keydown` +/-; **no automated UI test** |

## Semantic hierarchy (roadmap §2)

| # | Acceptance criterion | Status | Evidence |
|---|----------------------|--------|----------|
| 2.1 | Global state actions only in Game menu | **Pass** | `ui-structure.test.mjs`; audit screenshots |
| 2.2 | Zoom/fit map-local; unit actions in inspector | **Pass** | Toolbar ids; sidebar inspector |
| 2.3 | Spectator controls only when relevant | **Pass** | CvC fog toggle in structure test |
| 2.4 | Keyboard, SR, portrait/landscape audit | **Fail/Defer** | iPad layout ok visually; **no** SR/focus walkthrough |
| 2.5 | Sidebar useful with no selection | **Partial** | Overview + reports present; not formally measured |
| 2.6 | Regression: confirm import, no orders on gestures | **Partial** | Import/export in menu; gestures **untested** |

---

## Control inventory (scope)

| Control / area | Expected scope | Location | Notes |
|----------------|----------------|----------|-------|
| New campaign, test scenarios, save I/O | Global | `#gameMenu` | Confirmed |
| Next round, auto-play, batch | Session | Top bar / simulation | Outside sidebar |
| fitWorld, zoom ±, recenter | Map | `.toolbar-right` on map card | `aria-label` on fit/zoom |
| Unit/city orders | Selection | `#inspector` sidebar | |
| Event log, overview counts | Feedback | Sidebar sections | |
| `touch-action` / scroll | Map vs page | `styles.css` | `touch-action:none` on map surface (verify in CSS) |

---

## Gap list (Phase 1 — implement only if approved)

| ID | Gap | Severity | Suggested fix |
|----|-----|----------|---------------|
| G1 | No automated pinch/pan/tap regression | Medium | Extract pure `pinchTileScale(prev,next,...)` helper + unit tests; optional Playwright pinch simulation |
| G2 | `Escape` did not close Game menu (only click-outside) | Low | Close `#gameMenu` when open on Escape (before clearing selection) — **fixed in P4 audit PR** |
| G3 | Full a11y audit (focus trap, roles, SR labels on menu) | Low | Manual checklist or follow-up UX PR |
| G4 | Overview-scale tile tap targets | Low | Manual verify; optional “tap to zoom” if user reports misses |
| G5 | Default CI lacks HTML load smoke | Low | `smoke/ui-load.mjs` in verify — **added in P4 audit PR** |
| G6 | Playwright capture-production remains opt-in | Info | Document 9A in `TEST_STRATEGY.md`; time job before promoting to default CI |

**Explicitly not gaps** (already satisfied): fit-world math, game menu migration, sidebar scenario purge, visual fit on iPad/desktop per screenshots.

---

## P4 roadmap item 9 (CI smoke)

| Option | Decision |
|--------|----------|
| 9A Opt-in Playwright | **Keep** — `capture-production` ~minutes + browser install |
| 9B Minimal verify smoke | **Adopt** — `smoke/ui-load.mjs` asserts built `index.html` contracts |
| 9C Playwright in default verify | **Defer** until timed run shows p95 ≤30s with cached browsers |

---

## Next steps

1. Review gap list; approve Phase 1 scope (G1, G3, G4 optional).  
2. G2 + G5 shipped with this audit unless reverted.  
3. Close P4 in roadmap only after G1 or explicit waiver + TEST_STRATEGY CI note updated.