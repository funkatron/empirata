# Q17 OODA plan — ALG-AI-002 `0x3ADC` invasion reachability (slice D)

**Roadmap:** Classic migration slice **D** — one ALG per PR.

## Observe

- Q5/Q9/Q13 delivered inventory/coast/`0x383D` scout proxies; **`0x3ADC` path threat is still missing** (`agents/classic-migration-slices.md`).
- DOS: up to **~20 tracked enemy map cells**; if **any** is army-reachable to the city (type-0 mask, charted `ES:234` glyphs, shared path budget), production → **army**.
- Empirata today: `nearEnemies > 5` / `> 2` are scout distance gates, not path reachability.

## Orient

- Direction **enemy loc → city** (invasion), using **faction PlayerView** terrain/city intel (not live omniscient tiles for passability).
- Insert **after** grade-B destroyer branch, **before** fighter / ship-mix / `nearEnemies > 2` army (`docs/DOS_ALGORITHM_RULESET.md` table).
- Reuse `classicPathBudget`; fresh enemy sightings fill tracked list (stale slots `[?]` until binary trace).

## Decide

PR `cursor/q17-alg-ai-002-3adc-85b7`:

- `classicTrackedThreatLocations`, `classicCityPathInvasionThreat` (+ shared reachability helper)
- `tests/alg-ai-002-3adc-threat.test.mjs` (positive/negative path, destroyer priority above threat)
- Doc touch: ALG §2 mapping row for ALG-AI-002; slice **D** → done; **v0.5.6**

## Act

`npm test` → push → PR.

**Status:** implemented on `cursor/q17-alg-ai-002-3adc-85b7` (493 tests).