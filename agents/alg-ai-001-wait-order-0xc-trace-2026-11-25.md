# ALG-AI-001 order `0xC` and order-5 targets

> **Correction (2026-11-26):** `62F2`, `62F4` and `62F6` are not options with default 1. They are grade-B flags `62E8[5…7]`, rewritten by `0xF40F` on every computer turn: **0 on grade 1** (Empirata's default), 1 on grade 2. See `alg-ai-003-mode-flags-trace-2026-11-26.md`.

```text
RUN_ID: wait-order-0xc-2026-11-25
TRACE_ID: wait-order-0xc
IMAGE_SHA256: 145cfabac7ecac70c92a63539fb2d6a2b626e3249c44e5f4cc58ad43a922358b (227408)
FINDING: Order 0xC is computer ship escort (24A = escorted unit index), not Wait. Every computer order-5 writer stores a map location.
EMPIRATA_GAP: classic AI never assigns escorts; classicEscortStep only runs for player-set escort orders.
NOTES: 0x1D6AA-0x1D83A; 0x1DD44-0x1DE29; 0x1F94E-0x1FA07; 0x1DE2A-0x1DF55; 0x421E-0x4248; type table 0x44B2
```

Only four instructions in the image store a constant 5 or 0xC into the order array `14E6` (`26 C6 07 05`, `26 C6 07 0C`, `26 C6 00 05` searched): `0x1D7E1`, `0x1DDF1` (0xC) and `0x1DF0A`, `0x1F9DF`, plus `0x1F66E` (5, already traced in `0x1F5F4`).

Unit types (from the reissue table `0x44B2` and ALG-006): 0 army → `0x4474`, 1 fighter → `0x4482`, 3 transport → `0x448E` (`1D09:0004`), 6 carrier → `0x449A` (`1D09:020E`), 2 destroyer / 4 submarine / 5 cruiser / 7 battleship → `0x44A6` (`1D09:0116`).

## 1. `0x1D6AA(X, limit)` — escort assignment [D]

Callers: `0x1D0E4` (transport reissue), `0x1D1F3` (warship reissue), `0x1D2EA` (carrier reissue).

1. If `17F6[X] >= limit`, return.
2. Scan units `6D9E−1 … 0` for: `84E != 0`, owner `17FA == 6CB4` (current player), type `1AB2` ∈ {**4, 2, 5**} (submarine, destroyer, cruiser), order `14E6` ∈ {**0, 3, 0xB, 0xD**}. Keep the nearest by `1E46:0957` (distance) to X.
3. If found (`0x1D7CF`): `order = 0xC` (`0x1D7E1`), `24A = X` (`0x1D7FB`), `17F6[X] += 163C[escort]` (`0x1D81A`). Repeat while `17F6[X] < limit` (`0x1D82C`).

`17F6` is a per-unit escort-strength total; `163C` is a per-unit byte added per escort **[?]** meaning (strength or hits).

## 2. `0x1DD44(U)` — attach to a transport [D]

Caller `0x1D23C` (warship reissue, types 2/4/5/7). Random start `rand() % 6D9E`, scan every unit once: type **3** (transport), `84E != 0`, owner = current player, and `1A9E:006C(U loc, transport loc)` nonzero (reachable by sea). First hit: `order[U] = 0xC` (`0x1DDF1`), `24A[U] = transport index` (`0x1DE01`), return 1.

## 3. Order-5 writers [D]

| Writer | Routine | `24A` |
|---|---|---|
| `0x1DF0A` | `0x1DE2A` ship hunt (see `alg-ai-001-carrier-1de2a-trace-2026-11-25.md`) | remembered enemy **location** |
| `0x1F9DF` | `0x1F94E(unit, list, n)` fighter: first nonzero list location within `91B4`; order **4** instead if `163C[unit] == 91B4` | **location** |
| `0x1F66E` | `0x1F5F4` army: sighting ring `0xD02` | **location** |

So order 5's `24A` is always a map index in computer play, consistent with picker `0x46FC` (`> 7` → path to that map index).

## 4. Dispatch `0x421E` (order 0xC) [D]

If `62F2 == 0`: status 1 (reissue). Else status `(84E[24A] == 0)` — reissue only when the escorted unit is gone. `62F2` defaults to 1 and has no direct store in code **[?]** (likely an option).

## 5. Open

- **Human Escort key** **[?]**: no human-side store of 5 or 0xC was found as a constant; the UI likely writes the order byte from a variable. Needs a DOSBox check: give a unit an escort order and read `14E6[u]` / `24A[u]`.
- Whether the name table `0x2FD7B` is indexed for orders 9–12 was not traced.

## Empirata mapping

| DOS | Empirata |
|---|---|
| Order 0xC + picker `0x4600` | `classicEscortStep` / `classicEscortCloseRangeGoal` — logic exists, but only for player-set `{kind:'escort', targetId}` |
| `0x1D6AA` escort assignment | **none** |
| `0x1DD44` attach to transport | **none** |
| `0x421E` release when target dies | escort with a missing target — check `classicEscortStep` |
| Order 5 = go to location | `move-to` |

## Proposed engine change (not in this PR)

In classic reissue for transports, carriers and warships, add `0x1D6AA`: pick the nearest own submarine/destroyer/cruiser that is idle (none / random-move / orders 0xB, 0xD analogues) and give it `{kind:'escort', targetId}`, adding a per-unit escort weight until a limit. For warships without a task, add `0x1DD44`: escort a random reachable own transport. Keep player escort as is until the human-key DOSBox check is done.
