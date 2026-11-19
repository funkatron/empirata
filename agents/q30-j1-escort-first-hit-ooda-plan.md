# Q30 J1 — escort station `1D09:03C2` first-hit (2026-11-19)

## Observe

- I1 (#172) shipped **[T]** lexicographic station ranking (distance / behind / sea / city).
- #176 ruleset row: DOS uses **8 chart-dir walk** (`1D09:0DF56`) and **`1A9E:006C`** reachability — **first hit**, not lexicographic sort.
- `classicRouteStep` already implements `1A9E:014A` budgeted BFS for one step.

## Decide

- Add `classicUnitReachableGoal` (boolean `0x400E` / `006C` analogue).
- `classicEscortStationCandidates`: neighbors of target in `directions` order (0…7), chart-passable, **reachable**; no heuristic sort.
- **20-angle** outer ring: not implemented in J1 — document as distance-1 / eight-mask only until static trace supplies slot table.

## Act

- Branch `cursor/j1-escort-03c2-first-hit-85b7`; **v0.6.16**
- Tests: `alg-ai-001-escort-station.test.mjs` (probe order + blocked-neighbor fixture)
- Ruleset Empirata row: station probe **[D] partial** (8-dir + reachability)