# P4 OODA plan (2026-11-16)

Roadmap: [P4 — Remaining UI confidence](../docs/ROADMAP.md#p4-remaining-ui-confidence) (items 8–9).

Related spec: [Priority 1 — Map navigation and semantic UI architecture](../docs/ROADMAP.md#priority-1--map-navigation-and-semantic-ui-architecture-2026-10-26).

## Observe (facts)

### Roadmap asks

| # | Item |
|---|------|
| 8 | Audit Priority 1 map UX vs merged **#62** (camera) / **#63** work; **implement only demonstrably missing** behavior |
| 9 | Optional: one **inexpensive** real-browser smoke in default CI if runtime acceptable; else keep Playwright **opt-in** |

### Already in source (claimed implemented, not fully accepted)

| Area | Evidence | Automated check |
|------|----------|-----------------|
| **Camera math** | `src/ui/camera.ts` — `fitTileSize`, `maxTileSize`, `clampTileSize` | `tests/ui-camera.test.mjs` (iPad-ish viewports, no hard 11px floor) |
| **Pinch / pan / fit** | `src/ui/main.ts` — pinch anchor, `suppressTap`, `fitWorld`, toolbar | **No** gesture regression tests (logic lives in event handlers) |
| **Game menu / migration** | `public/index.html` — `gameMenu`, campaign controls; scenarios under menu | `tests/ui-structure.test.mjs` (ids, no `startSkirmish` in toolbar) |
| **Map toolbar** | `fitWorld`, zoom buttons, `studyMapButton` | Structure test only |
| **Sidebar scope** | Inspector + log in `<aside class="sidebar">` | Partial HTML assertions; no full acceptance #1/#5 audit |
| **Observer / CvC** | Spectator fog toggle | `ui-structure.test.mjs` |
| **Perf** | rAF paint, terrain/fog cache (#62 era + snappiness branch) | `observer-map.test.mjs`, `smoke/observer-batching.mjs` in **verify** |

### CI / smoke today (`docs/TEST_STRATEGY.md`)

| Layer | What runs |
|-------|-----------|
| **Default `verify`** | `npm test` (or focused build), `smoke/bundle.mjs`, `smoke/observer-batching.mjs` — **no browser** |
| **Opt-in Playwright** | `capture-production-browser.yml` → `smoke/capture-production.mjs` (WebKit, iPad + desktop profiles, **~minutes**, installs browser) |
| **Other opt-in** | `map-screenshots`, `map-paint-timing`, `test:observer` |

### Priority 1 acceptance checklist (roadmap) — verification status

| Acceptance (summary) | Status |
|------------------------|--------|
| Pinch direction + anchor | **Unverified** in CI; code present in `main.ts` |
| Pan/tap vs order (no accidental orders) | **Unverified**; `suppressTap` exists, no test |
| Fit world full 100×60 on iPad/phone viewports | **Partial** — math tested; not layout/crop in browser |
| Zoom bounds / resize / no NaN | **Partial** — `clampTileSize` only |
| +/- and keyboard still work | **Unverified** automated |
| Global actions only in Game menu | **Partial** — `ui-structure` spot checks |
| Map-local zoom/fit | **Partial** — ids present |
| Sidebar empty selection UX | **Manual** |
| a11y (focus, Escape, roles) | **Manual** |
| iPad portrait/landscape audit | **Open** (WORKSTREAM E) |

### Constraints

- **P4 is UX confidence**, not new modern AI or engine rules.
- Prefer **smallest fix** per roadmap; do not redesign G1–U1 beyond checklist failures.
- UI edits require **browser evidence** per `AGENTS.md` (manual or Playwright artifacts).
- **OODA** before multi-step UI work (`AGENTS.md`).

## Orient (interpretation)

1. **#62/#63 baseline is largely landed** — P4 is **acceptance + gaps**, not greenfield camera/menu work.
2. **Largest holes:** (a) **gesture/no-accidental-tap** behavior without automated proof; (b) **iPad visual audit**; (c) **a11y** checklist; (d) **CI policy** for item 9.
3. **Extracting testable pinch math** (like `camera.ts`) may be cheaper than full Playwright for some acceptance bullets — only if audit shows handler bugs vs missing tests.
4. **Default CI browser smoke** likely **fails cost gate** if it mirrors `capture-production` (Playwright install). A **minimal** smoke (e.g. load `index.html`, assert `#map` + one click) might be measurable separately.
5. **WORKSTREAM E** should move when P4 closes with artifact links, not before.

## Decide (scope and PR sequence)

### Phase 0 — Audit only (recommended first PR: `cursor/p4-audit-85b7`)

**Deliverable:** `agents/p4-priority1-audit.md` (or `docs/ui/PRIORITY1_AUDIT.md`) containing:

- Checklist matrix: each Priority 1 acceptance row → pass / fail / partial / not tested + evidence (screenshot path, test name, or code pointer).
- Control inventory table (scope column from roadmap) for current `index.html` / `main.ts`.
- iPad portrait + landscape captures via `smoke/capture-production.mjs` **workflow_dispatch** or `computerUse` (store under `/opt/cursor/artifacts/` or CI artifact pattern).
- Explicit **gap list** for phase 1 (no fixes in audit PR).

**Success:** Product owner can approve implementation scope from gap list alone.

### Phase 1 — Implement gaps only (`cursor/p4-ui-fixes-85b7`)

**In scope (examples — finalize from audit):**

- Pure tests for any extracted gesture/camera helpers.
- Targeted `main.ts` / CSS fixes for **failed** acceptance rows only.
- Extend `ui-structure.test.mjs` or add `tests/ui-gestures.test.mjs` for **testable** DOM/contracts.
- Engine-neutral; run `npm test` + manual/browser demo video for UI changes.

**Out of scope unless audit proves gap:**

- New scenarios, AI, save schema, full a11y retrofit, terrain atlas rework.
- Moving controls back to sidebar.

### Phase 2 — CI smoke decision (`cursor/p4-ci-smoke-85b7` or fold into phase 1)

| Option | When |
|--------|------|
| **A. Stay opt-in** | Playwright job stays >~60s or needs browser deps every PR → document in `TEST_STRATEGY.md`; close roadmap item 9 as “deferred, measured”. |
| **B. Minimal default smoke** | New `smoke/ui-load.mjs` (no Playwright): HTTP serve `dist/`, fetch HTML, assert critical ids — runs in verify, <5s. |
| **C. Lightweight Playwright in verify** | Only if a **timed** `workflow_dispatch` on `main` shows p95 within roadmap budget (~30s) **including** install amortization strategy (cache) — unlikely without infra work. |

**Recommend:** Plan for **A + B**; treat **C** as stretch.

### Phase 3 — Close P4

- Update `docs/ROADMAP.md` (P4 closed, residual manual iPad sign-off if any items remain manual-only).
- Update `WORKSTREAM_STATUS.md` stream E with audit artifact + PR links.
- Optional: add Priority 1 “verified” subsection in `TEST_STRATEGY.md` (what is automated vs manual).

## Act (ordered steps)

1. Merge this plan (`agents/p4-ooda-plan.md`) if not already on `main`.
2. Branch `cursor/p4-audit-85b7` from `main`.
3. Run local `npm run build && npm start` (or static `dist/`) for desktop sanity.
4. Execute Priority 1 checklist against live UI; record matrix.
5. Run or dispatch **capture-production** for iPad + desktop screenshots; attach to audit doc.
6. Open audit PR (docs only); review gap list with user.
7. **Stop until gaps approved** — then phase 1 per gap (one or more PRs).
8. Time opt-in Playwright; decide 9A/9B/9C; implement in separate commit/PR.
9. Close P4 in roadmap + workstream.

## Risks

- **False “done”** from HTML structure tests without gesture verification.
- **Flaky Playwright** if added to default CI without budget.
- **Audit scope creep** into full UI redesign — hold to checklist + demonstrable failures only.

## Success criteria (P4 complete)

- Documented audit with evidence for every Priority 1 acceptance bullet (pass or explicit deferred).
- All **audit-identified** failures fixed or explicitly waived in roadmap.
- CI/browser policy for item 9 **decided and documented**.
- No regression: `npm test` 432+, verify green, bundle smoke green.