# ALG-AI-001 None order and idle units — static trace (2026-11-24)

**TRACE_ID:** `none-order-static`. **Evidence:** [D] static disassembly of the private unpacked image (227,408 bytes; SHA-256 `145cfab…`, see `alg-ai-001-compass-order-trace-2026-11-24.md` for the digest note). Text excerpts only; no game bytes committed. Direction indices below are **DOS ring indices** (0 E, 1 NE, 2 N, 3 NW, 4 W, 5 SW, 6 S, 7 SE).

## Activation flow (`0x3BFC`)

| Step | Offset | Behavior |
|---|---|---|
| Scratch | `0x3C13–0x3C2A` | `8ADC = ±1` (unit index odd → `+1`); `8ADE = 3 × 8ADC` |
| Go-home / cleanup / dispatch | `0x3CEA` → `0x3D10` | returns order handler status |
| Reissue | `0x3CEE–0x3CF3` | status ≠ 0 → `0x4462` |
| Pick direction | `0x3CF6` → `0x44EA` | result stored, then `0x47E0` type step |

## Order 0 (None)

- Dispatch `0x3E00`: `mov ax,1` → return. Status 1, **not a direction**.
- So `0x4462` always runs: jump on unit type (table `cs:0x8C2` at `0x44B2`): army `1F23:0008`, fighter `1F23:0588`, transport `1D09:0004`, carrier `1D09:020E`, other ships `1D09:0116`. Afterwards order/dir are reloaded (`0x44C2`).
- `0x44EA`: `order − 1`, bound `≤ 0x10`, table `cs:0x92C` (`0x451C`). Order 0 underflows to `0xFFFF` → `0x453E`: **return `−1` (stay)**. Order `0x10` → `0x4542` (wander). Order `0x11` → `0x453E` (stay).

**There is no default bearing.** Empirata's `CLASSIC_ORDER_NONE_DIRECTION_INDEX = 1` ("north") was based on reading the `0x3E00` status as a direction.

## Army type AI `1F23:0008` (linear `0x1F238`)

| Case | Offsets | Result |
|---|---|---|
| On a city tile (glyph class 3, `0x1F271`) | `0x1F279–0x1F2C6` | order `0x11`; try `12C2:0845`, `0x1F454`, then explore probe `03BF:0C6E`. Probe hit → wander (below); else stay. |
| Elsewhere | `0x1F2C8–0x1F30D` | try `0x1F454` (parity-gated), `0x1F5F4`, `0x1F6AA` (strategic) |
| Target bearing found (`91B2 ≥ 0`) | `0x1F30F–0x1F336` | order `0x0F`, dir = `91B2` |
| Already wandering (order `0x10`) | `0x1F33A–0x1F34A` | keep order and heading |
| Otherwise | `0x1F34C–0x1F36E` | order `0x10`, dir = `03BF:0C46` |

### Wander heading `03BF:0C46` (linear `0x4836`)

`r = rand() % 24`; if `r ≥ 8`: `r = (r & 7) | 1`. Diagonals get 5/24 each (≈ 83 % total), orthogonals 1/24 each.

### Wander step `0x4542`

`cand = (dir − 8ADE) & 7` (three ring steps back). If `12C2:099C(unit, cand)` passes, start = `dir`; else start = `cand`. Then `0x4C52` sweep from start; success stores the new dir in `ES:24A`; exhaust returns `−1` and keeps the old heading.

### Explore probe `03BF:0C6E` (linear `0x485E`)

Start at `[out] | 1` (caller passes 0 → NE). Eight probes: odd indices 1, 3, 5, 7, then (`0x48AB`) switch to even 2, 4, 6, 0. Accept the first dir where `12C2:099C` passes, `loc + 2·delta` is on the map (`1E46:0C7F` = 0), and the faction chart `ES:234[player base + loc2]` is **0 (uncharted)**. The found dir is discarded by the caller (`0x1F2BF` → `0x1F34C` rolls a fresh heading).

### `12C2:099C`

Full per-direction move check: `loc + delta[dir]`; off-map (`1E46:0C7F`) → 0; then chart glyph vs unit type. Empirata analogue: `classicTilePassableChart` on the neighbor.

## Ships and fighters

`1D09:0004 / 0116 / 020E` (`0x1D187`, `0x1D27F`, `0x1D433`) and fighter `0x1F920` write **order 3** and a `0x4836` heading. Order 3 → `0x3F64` → (non-fighter) Random `0x3F0C`; direction picker for order 3 is `0x45A2` (**not traced**).

## Empirata mapping (v0.6.18)

| DOS | Empirata |
|---|---|
| `0x4836` heading | `classicWanderHeadingRoll` |
| `0x4542` | `classicArmyWanderStep` |
| `0x485E` | `classicCityArmyExploreProbe` |
| Army type AI, None branch | `classicIdleNoneStep` (strategic analogues `classicArmyConquestStep` etc. run first in the executor) |
| `ES:24A` heading | `Unit.classicWander.direction` (engine index; save-validated) |
| Ship/fighter order 3 | rolled heading + plain `0x4C52` sweep **[?]** until `0x45A2` is traced |

`12C2:0845`, `0x1F454`, `0x1F5F4`, `0x1F6AA` are not traced here; Empirata's existing army strategic steps stand in for them.

## RUN_ID

```text
RUN_ID: none-order-static-2026-11-24
IMAGE_SHA256: 145cfabac7ecac70c92a63539fb2d6a2b626e3249c44e5f4cc58ad43a922358b
NONE_DEFAULT: none; 0x44EA returns -1 for order 0
ARMY_IDLE: city -> garrison unless 0x485E finds uncharted land 2 out; else wander 0x10
WANDER: heading 0x4836 (rand%24, >=8 -> odd); step 0x4542 (3-back side check + 0x4C52)
SHIPS_FIGHTERS: order 3 + 0x4836 heading; 0x45A2 open
OPEN: 0x45A2, 12C2:0845, 0x1F454, 0x1F5F4, 0x1F6AA
```

## Campaign observation (not a pass/fail target)

Classic vs classic, 150 rounds, layouts continents / islands / archipelago × seeds 17 / 83 / 211:

| Variant | Cities held | Units | On rim |
|---|---|---|---|
| `main` | 19 | 221 | 24 |
| DOS ring only | 26 | 226 | 67 |
| DOS ring + None (this trace) | 45 | 331 | 32 |

Idle unit-rounds: 13 % garrisoned in own cities, 1 % in the open.
