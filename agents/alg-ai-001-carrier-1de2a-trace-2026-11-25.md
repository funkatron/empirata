# ALG-AI-001 ship hunt `0x1DE2A` and carrier order `0xA`

```text
RUN_ID: carrier-1de2a-2026-11-25
TRACE_ID: carrier-1de2a
IMAGE_SHA256: 145cfabac7ecac70c92a63539fb2d6a2b626e3249c44e5f4cc58ad43a922358b (227408)
FINDING: 0x1DE2A sends a ship (order 5) to the nearest sea-reachable remembered sighting of an enemy type in its hunt mask; the carrier caller rewrites the order to 0xA. Order 0xA becomes 9 on arrival.
EMPIRATA_GAP: no per-type sighting memory and no hunt order.
NOTES: 0x1DE2A-0x1DF55; callers 0x1D1FD (warships), 0x1D3CC (carrier); masks DS:4BE4; sighting table writer 0x1EB32 (from 0x1EA88); dispatch 0x4152
```

## 1. `0x1DE2A(ship)` [D]

1. `mask = DS:4BE4[type]`: destroyer `0x38`, submarine `0x38` (destroyer, transport, submarine); cruiser `0x3E` (destroyer … carrier); carrier `0x3A` (destroyer, transport, submarine, carrier); battleship `0x3F` (destroyer … battleship); transport 0.
2. For enemy classes 2 … 7 whose `6464` bit is in the mask, read 5 slots at `0x5A + player*0x3C + class*0xA` (`0x1DEC7`).
3. Keep a slot location when `1E46:0957` distance ≤ best and `1A9E:006C` (sea) path cost `c` is nonzero and ≤ best; best = `c − 1`; then `order = 5` (`0x1DF0A`), `24A = location`.
4. Return 1 if anything was chosen.

## 2. Sighting memory `0x5A` [D]

`0x1EB32(loc, type, player)` (only caller `0x1EA88`, sight chain): if `loc` is already in the 5 slots, done; else use an empty slot, or shift slots down and put `loc` first. Five most-recent enemy locations per player per unit type.

## 3. Callers [D]

| Caller | After success |
|---|---|
| `0x1D1FD` (warship reissue, types 2/4/5/7) | keep order **5** (hunt) |
| `0x1D3CC` (carrier reissue, after the `n=10` station path fails) | rewrite order to **0xA** (`0x1D3E2`); `24A` stays the hunt location |

## 4. Dispatch `0x4152` (order 0xA) [D]

If `8AD6 == 8AD8` (at the goal): order **9**, status 0. Else read the goal glyph on the player's chart: 0 (unexplored) or 2 (sea) → status 0 (keep going); anything else → status 1 (reissue). Picker `0x46FC` paths to the location.

`0x1DE2A`'s “`0xA` without `24A` store” in `alg-ai-001-reissue-1d39f-trace-2026-11-24.md` is resolved: `24A` is stored inside `0x1DE2A`.

## Empirata mapping

| DOS | Empirata |
|---|---|
| Sighting memory per type | none (ALG-AI-002 `0xD02` ring is a different, untyped list) |
| Hunt (order 5) | none |
| Carrier order 0xA → 9 | none |

## Proposed engine change (not in this PR)

Add a per-faction, per-unit-kind list of the 5 most recent enemy sightings. In classic warship reissue, try `0x1DE2A` (mask table above) before random wander; carriers use it as the fallback after the station search and store a station order that turns into “hold” (order 9) on arrival.
