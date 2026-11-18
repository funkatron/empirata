# ALG-AI-001 `0x4C52` — DOS row vs Empirata (2026-11-18)

**Evidence grade:** **[D]** for the DOS behavior description (from `docs/DOS_ALGORITHM_RULESET.md` move/order table, sourced from unpacked EMPIRE.EXE analysis). Empirata mapping is **implementation parity intent**, not a fresh Ghidra/Raiden trace in this slice.

## DOS (`0x4C52` legalize direction)

| Step | Behavior |
|------|----------|
| Input | Preferred compass index for the unit |
| Rotation | Up to **8** attempts; each step adds **±1** to the index (sign from unit-index parity) |
| Accept | First direction that passes movement eligibility (`12C2:099C`) and tile probe (`0x4B52`) |
| Exhaust | Write direction **`-1`** (stay); caller keeps position |

Related: **Random** `0x3F0C` uses `rand()%16` to rotate bearing; **None** uses a fixed north-class default in Empirata (`CLASSIC_ORDER_NONE_DIRECTION_INDEX = 1`).

## Empirata (v0.6.10+)

| DOS piece | Code | Notes |
|-----------|------|-------|
| 8-way ±1 probe | `classicResolveLegalDirection` in `src/engine/ai/classic-path.ts` | Uses `classicRandomRotationBias(unit)` for ±1 order; chart passability via `classicTilePassableChart` (v0.6.9) |
| Rim illegal step | `classicRimAwarePreferredIndex` | Heuristic: at `y===1` with north blocked, start rotation from south (index 5) |
| Exhaust / stay | `classicAdvanceBearingWhenBlocked` + executor | When no step after 8 tries, advance `go-direction` bearing for the **next** activation (DOS **`-1`** analogue: no move this pass) |
| Standing orders | `classic-executor.ts` | `none` / `random` paths call resolve + persist winning index before `moveUnit` |

## Gaps (not claimed closed)

- DOSBox A/B protocol: `agents/alg-ai-001-4c52-dosbox-experiment-2026-11-18.md` (I2). No captured run log in-repo yet.
- Full coupling of **`-1`** to `ES:24A` overload fields (escort target index vs compass) is documented in ruleset but not re-traced here.
- Coastal **ship-B** mask + chart unknown tiles can still block all eight neighbors (see H2 islands fixture).

## Tests

- `tests/alg-ai-001-rim.test.mjs` — lab rim + bearing advance
- `tests/alg-ai-001-islands-rim-regression.test.mjs` — organic save (H2)