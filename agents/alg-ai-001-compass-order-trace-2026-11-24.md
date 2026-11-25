# ALG-AI-001 compass order — static trace (2026-11-24)

**TRACE_ID:** `compass-order-static`. **Evidence:** [D] static disassembly of the private unpacked image (227,408 bytes; SHA-256 of the analyzed copy `145cfabac7ecac70c92a63539fb2d6a2b626e3249c44e5f4cc58ad43a922358b`). Offsets are image-linear, as in `docs/DOS_ALGORITHM_RULESET.md`. Text excerpts only; no game bytes are committed.

> Digest note: `tools/disasm_empire_anchor.py` expects `0a06eba8…`. This copy differs in digest but matches the ruleset size and every anchor checked (`0x4C52` calls `12C2:099C` and near `0x4B52`; `0x3F0C` matches the Random row; dispatch table at `0x3E54`). Run the tool with `--expect-sha256 ""` for this copy.

## Findings

### Q1 — DOS direction table [D]

DOS stores **8 word location deltas**, not (dx, dy) pairs. Location = `Y*100 + X` (Y grows south).

- `0x4CB6–0x4CC3` (`0x4C52`): `bx = dir*2; es = [ds:0x82DC]; ax = es:[bx+0x6300]; ax += unit_loc` → pushed to tile probe `0x4B52`.
- `0x3F0D–0x3F1C` (`0x3F0C` Random): same `es:[bx+0x6300]` lookup with `dir = [0x8AD6]`.
- Table bytes at linear **`0x34620`** = segment `0x2E32` (loaded literally at `0x4C1B`) + offset `0x6300`. Only match for the set {±1, ±99, ±100, ±101} in the image.

| DOS index | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|---|
| Delta | +1 | −99 | −100 | −101 | −1 | +99 | +100 | +101 |
| Compass | **E** | NE | N | NW | W | SW | S | SE |
| Empirata `directions[i]` | 4 | 2 | 1 | 0 | 3 | 5 | 6 | 7 |

### Q2 — Ring order [D]

Yes. DOS order is a **counter-clockwise compass ring starting at East**. Every ±1 step (mod 8) is an adjacent compass point.

Empirata `world.ts` `directions` is row-major `[NW, N, NE, W, E, SW, S, SE]`, which is **not** a ring. Code that rotates it by ±1 index does not reproduce DOS:

| Empirata code | Effect today |
|---|---|
| `classicResolveLegalDirection` (`0x4C52` analogue) | From N with +1: N, NE, **W, E**, SW, S, SE, NW. DOS from N (2) with +1: N, NW, W, SW, S, SE, E, NE. |
| `classicAdvanceBearingWhenBlocked`, `classicRandomOrderTick` | ±1 can jump non-adjacent (NE → W). DOS Random: `dir = (dir + [0x8ADC]) & 7` at `0x3F50–0x3F57`, a ring step. |
| `classicRimAwarePreferredIndex` | Index labels wrong (5 = SW, 7 = SE, 3 = W); west/east branches unreachable. |

### Q3 — Rotation in `0x4C52` [D]

- Start: `si = [out_ptr] & 7` (`0x4C80–0x4C86`); **first probe is the current direction**, no rotation before it.
- Count: 8 attempts (`[bp-4] = 8`, `0x4C89`).
- Sign: unit index arg `[bp+6]` **odd → +1, even → −1** (`0x4C6E–0x4C7D`). In DOS order +1 is counter-clockwise.
- Accept: `12C2:099C(unit, dir)` nonzero **and** `0x4B52(unit, loc + delta[dir])` nonzero → write dir, return 1.
- Exhaust: write **`−1`**, return 0 (`0x4CE6–0x4CF1`).

Empirata derives the sign from XOR of unit-id characters (even → +1). DOS uses the slot index; Empirata has no equivalent index, so this stays a surrogate. Document it; do not chase.

### Q4 — None default [D] (corrects ruleset)

Dispatch: `0x3DED–0x3DFB` loads order `[0x8ADA]`, bounds `≤ 0x11`, `jmp cs:[bx+0x264]` (table at `0x3E54`). Order 0 → `0x3E00`: **`mov ax,1` → return**. Every handler returns AX through the same exit; it is the step-3 status the caller tests before `0x4462` reissue, **not a direction index**.

- Ruleset "None: return direction **1**" is a misreading → should read "return **1** (reissue)".
- Empirata `CLASSIC_ORDER_NONE_DIRECTION_INDEX = 1` (engine N) rests on that misreading. Under DOS index order a literal "direction 1" would be NE, not N; under the corrected reading None picks no direction here at all. The direction comes from `0x4462` / `0x44EA` (not traced in this note).

### Q5 — Rim special case [D, negative]

`0x4C52` has **no** X/Y bound or rim logic. Border tiles are rejected only by `12C2:099C` / `0x4B52`. `classicRimAwarePreferredIndex` has no DOS counterpart in this routine; it is an Empirata heuristic.

### Q6 — Random `0x3F0C` [D]

1. Probe `1E46:0C7F(loc + delta[dir])`; nonzero → return 1.
2. Else `rand() % 16` (`0x3F32–0x3F3D`); if 0: `dir = (dir + [0x8ADC]) & 7`, stored to `ES:24A[unit]` and `[0x8AD6]` (`0x3F41–0x3F5D`). Return 0.

Rotation is a ring step in DOS order. Value of `[0x8ADC]` (±1 per unit?) not traced here.

## RUN_ID

```text
RUN_ID: compass-order-static-2026-11-24
IMAGE_SHA256: 145cfabac7ecac70c92a63539fb2d6a2b626e3249c44e5f4cc58ad43a922358b (227,408 bytes)
DOS_ORDER: E,NE,N,NW,W,SW,S,SE (counter-clockwise ring)
RING: yes
NONE_DEFAULT: none in dispatch; order 0 returns status 1 (reissue), not a direction
RIM_SPECIAL_CASE: none in 0x4C52
EMPIRATA_GAP: ring mapping needed; rim heuristic removal; None default re-derivation
NOTES: table 0x34620 (2E32:6300); 0x4C52 loop 0x4C80-0x4CF1; Random 0x3F0C-0x3F63; dispatch 0x3DED-0x3E54
```

## Recommended engine follow-up (separate PRs)

1. **Ring mapping** — add `CLASSIC_DOS_DIRECTION_ORDER = [4, 2, 1, 0, 3, 5, 6, 7]` (DOS index → `directions` index). Rotate in DOS index space in `classicResolveLegalDirection`, `classicAdvanceBearingWhenBlocked` and Random. Do **not** reorder `world.ts` `directions` (human movement, rendering, tests share it). Gameplay change → patch bump + rim/islands regression review.
2. **Remove `classicRimAwarePreferredIndex`** (no DOS counterpart) in the same PR or right after; re-check `tests/alg-ai-001-rim.test.mjs` and the islands fixture.
3. **None default** — trace `0x4462` / `0x44EA` for order 0 before changing `CLASSIC_ORDER_NONE_DIRECTION_INDEX`. Until then mark it **[?]** in the ruleset.

Open: `[0x8ADC]` source; `0x4462` order-0 reissue path.
