# Q27 OODA plan — ALG-AI-001 chart pathing + map rim (2026-11-18)

**Status:** Plan for review — **do not implement until approved.**  
**Scope:** One PR after approval (`cursor/q27-alg-ai-001-chart-rim-85b7`). Preserve AGENTS.md one-ALG-per-PR; this PR is ALG-AI-001 path layer only (no production).

---

## Observe

### Documentation debt (addressed in doc-hygiene PR)

G1–G3 done on `main`; slice **H1** tracks movement/path gaps.

### Player report — ships “stuck” on map corners (CvC)

**Repro fixture:** `empirata-islands-seed-3898486421-round-376.json` (organic islands, classic grade 1, round ~376).

| Signal | Detail |
|--------|--------|
| Cluster | Many blue ships at **`y = 1`** and **`x ∈ {92…98}`** (top playable row, east rim); red mirror on **`x = 1…4`, `y = 1–2`** |
| Orders | Mostly **`none`**; `spent = 1` (one move attempt per activation, then hold) |
| Map rules | **`playable()`** excludes `x=0/99`, `y=0/59` ([`world.ts`](../src/engine/world.ts)); border row **y=1** is legal but **cannot step north** |

**Hypothesis (needs code + optional trace):**

1. **Random / none wander** (`0x3F0C` family) keeps a fixed compass bias ([`classicNoneOrderBearing`](../src/engine/ai/classic-order-tick.ts) → index `1` = north). At **`y=1`**, north steps are not playable → [`classicLegalDirectionStep`](../src/engine/ai/classic-path.ts) returns `null` → unit **does not move** but still burns the computer pass limit.
2. **Path goals** (move-to, go-home) use BFS on passability; goals on land/cities may be unreachable from rim sea tiles; failure may leave **no order clear** and units drift into rim via earlier random steps.
3. **DOS** likely writes direction **`-1`** (stay) when [`0x4C52`](../docs/DOS_ALGORITHM_RULESET.md) exhausts rotations — we may not reconcile bearing when all neighbors blocked (fleet piles on outer **ring** of playable sea).

This is **not** omniscience or spectator intel — classic executor uses the same `playable` + `classicTilePassable` as movement.

---

## Orient

### Target parity (ruleset)

| DOS piece | Empirata today | Gap |
|---------|----------------|-----|
| Chart glyph `ES:234[loc]` + mask byte (`0x1ACE0`) | Terrain/city-derived glyph candidates + **[D] masks** | No per-faction **chart knowledge** in ship path probes |
| `0x4714` / `1A9E:014A` goal step + budget | `classicRouteStep` + `classicPathBudget` | Same shape; chart layer mismatch |
| `0x4C52` legalize direction | `classicLegalDirectionStep` | Missing **“all blocked → stay + rotate bearing”** rim behavior |
| `0x3F0C` random | `classicRandomOrderTick` + rotate | No **retry other directions** when preferred step blocked |

### Out of scope for Q27

- ALG-AI-002 production changes  
- Modern AI  
- Full escort `0x4600` (optional follow-up **H1b** if timeboxed)

---

## Decide — proposed implementation (single PR)

### A. Chart-backed passability for classic movement (core)

1. **`classicChartGlyphAt(view, pos)`** — return glyph index for a **PlayerView** cell (use `view.cells[i].terrain`, city owner from intel, stale rules as today).
2. **`classicTilePassableChart(game, view, unit, pos, grade)`** — mask probe using chart glyph (replace terrain-only candidates in executor pathing only; keep human moves on existing rules if required — **default: classic policy only**).
3. Thread **`getPlayerView(game, faction)`** into `classicRouteStep`, `classicHomeRepairStep`, `classicMoveToStep`, and amphibious sea steps (minimal API churn).

**Tests:** extend `alg-ai-001-path.test.mjs` with view-known sea/land; fixture asserting path does not use uncharted tiles.

### B. Map rim / blocked-step behavior (fixes stuck piles)

1. **`classicLegalDirectionStep`** — if no step after 8 rotations, return **`null`** and set **`spent` to max** for the activation (already partially true); additionally expose **`classicBearingBlocked`** helper.
2. **`classicRandomOrderTick` / none bearing** — when preferred direction blocked, **pick next playable direction** (deterministic rotation from unit id), matching `0x4C52` “try ±1” spirit without claiming full trace until Raiden confirms.
3. **`classicSanitizeRimWander` (optional)** — for `none`/`random` on sea at `y==1` or `y==height-2` etc., bias away from border on `%16` rotate (heuristic until `[D]`).

**Tests:**

- Unit at `(50, 1)` on all-sea lab with `none` order **moves south** at least once over N activations (seeded RNG).
- Load **round-376 JSON** subset in test: assert destroyer at rim **changes position or bearing** over 3 classic activations (regression guard).

### C. Evidence / docs

- Update `docs/DOS_ALGORITHM_RULESET.md` ALG-AI-001 Empirata row: chart path **staged** after merge.
- Short note in `agents/` if Raiden traces `0x4C52` at border (optional **H1 [D]**).

### D. Version

- Patch **0.6.9** if behavior visible in CvC (rim fix); else doc-only subsection in README.

---

## Act — sequence after you approve

1. Branch `cursor/q27-alg-ai-001-chart-rim-85b7`.
2. Implement **B** first (rim) — fastest win for screenshot bug; ship with tests.
3. Implement **A** (chart passability) in same PR if sized OK; else **split: B → 0.6.9**, A → follow-up H1a.
4. `npm test`; observer smoke on islands seed; compare CI.
5. PR + merge when green (unless you request otherwise).

---

## Success criteria (for your review)

- [ ] CvC on islands seed 3898486421: after 50+ rounds, **< threshold** ships with `none` frozen on `y=1`/`x≥95` for 10+ consecutive activations (define threshold in PR, e.g. half of pre-fix count from saved JSON).
- [ ] No regression on `alg-ai-001-standing`, `alg-ai-001-depth`, amphibious tests.
- [ ] Classic policy-only chart path; human/rules-lab movement unchanged unless explicitly shared.

---

## Open questions for you

1. **Split PR?** Rim fix alone (0.6.9) vs combined chart+rIM.  
2. **Accept heuristic rim rotate** without new `[D]` trace, or wait for Raiden `0x4C52`?  
3. Should **modern** AI get rim fix too (shared `routeStep` / planners)?