# ALG-AI-001 contact tables (`6D44`, `6C82`, `6CD6`, `63CE`, `6464`, ship masks)

```text
RUN_ID: contact-tables-2026-11-25
TRACE_ID: contact-tables
IMAGE_SHA256: 145cfabac7ecac70c92a63539fb2d6a2b626e3249c44e5f4cc58ad43a922358b (227408)
FINDING: Chart glyphs are 4 terrain/neutral codes plus 10 per player (city, army, fighter x2, D T S R C B). 12C2:115F steps into an adjacent non-own city; 0x4A2A attacks (first mask) or turns away (second mask) per unit-type bit.
EMPIRATA_GAP: no contact steer/attack/flee in the classic type step.
NOTES: tables in DS 2E32 (image base 0x2E320); 12C2:115F at 0x13D7F; 0x4A2A-0x4B50; ship masks DS:4BD0 / DS:4BDC; 12C2:0845 at 0x13465
```

## 1. Glyph tables [D] (DS base `0x2E320`)

Chart glyph `g = chart[loc]` (per-player chart `234 + 6444[player]` in `0x4A2A`). Values per glyph:

| Glyph | `6D44` class | `6C82` owner | `6CD6` | `63CE` | Reading **[?]** (labels inferred from the columns) |
|---|---|---|---|---|---|
| 0 | −2 | 0 | 0 | 0 | unexplored |
| 1 | −1 | 0 | 0 | 0 | neutral city |
| 2 | −2 | 0 | 1 | 0 | sea |
| 3 | −2 | 0 | 0 | 1 | land |
| 10p−6 (4/14/24) | −1 | p | 0 | 0 | city of player p |
| 10p−5 | 0 | p | 0 | 1 | army |
| 10p−4 | 1 | p | 0 | 1 | fighter over land |
| 10p−3 | 1 | p | 1 | 0 | fighter over sea |
| 10p−2 … 10p+3 | 2 … 7 | p | 1 | 0 | destroyer, transport, submarine, cruiser, carrier, battleship |

Class = unit type (0 army … 7 battleship, ALG-006 order); −1 = city; −2 = terrain. `6CD6` marks sea glyphs, `63CE` marks land glyphs (by the pattern). Glyphs ≥ 34 belong to other tables.

`6464[class]` = `0x80 >> class`: army 0x80, fighter 0x40, destroyer 0x20, transport 0x10, submarine 0x08, cruiser 0x04, carrier 0x02, battleship 0x01.

## 2. `12C2:115F` (`0x13D7F`) [D]

For directions 8 … 1: neighbour glyph with class **−1** (city) and owner ≠ current player → write that direction, return 1. So: **step into an adjacent neutral or enemy city**. Used by the army type step `0x1F376`.

## 3. `0x4A2A(unit, &dir, mask)` [D]

For directions 8 … 1 on the per-player chart: skip own glyphs and classes < 0. Hit when `6464[class] & mask`. Extra rules when the target is a fighter (class 1): an army (`type 0`) skips a fighter over sea (`6CD6`); a ship (`type >= 2`) skips a fighter over land (`63CE`). On a hit, write the direction and return 1.

### Masks per caller

| Unit | First call (attack) | Second call (turn away: `dir = (dir + rand%3 + 3) & 7`) |
|---|---|---|
| Army | own glyph class 3 (aboard transport): `0xC0` = army, fighter; else `0xF0` = army, fighter, destroyer, transport | — |
| Fighter | `0xFF` = all | — |
| Destroyer (2) | `0x78` = fighter, destroyer, transport, submarine | `0x87` = army, cruiser, carrier, battleship |
| Transport (3) | `0x00` = none | `0xEF` = all but transport |
| Submarine (4) | `0x3F` = destroyer … battleship | `0xC0` = army, fighter |
| Cruiser (5) | `0xFF` = all | `0x00` |
| Carrier (6) | `0x10` = transport | `0xFD` = all but carrier |
| Battleship (7) | `0xFF` = all | `0x00` |

Ship masks are words at `DS:4BD0[type−2]` and `DS:4BDC[type−2]` (`0x1D54A`, `0x1D569`); the type−2 index is set at `0x1D525`. (The 2026-11-24 note read them at file offset `0x4BD0`, which is code.) The ship step skips the first pair when `62F4 == 0` (`0x1D52F`) and the first call when the order is 8 (`0x1D540`).

## 4. Correction: `12C2:0845` (`0x13465`) [D]

Returns 0 unless the unit is type 0 **and** its own chart glyph has class **3**. Class 3 is the **transport** glyph, so this is “army aboard a transport”, not “army on a city” (`alg-ai-001-army-strategic-trace-2026-11-24.md` §`12C2:0845`). Then for `62FE` neighbours 9 … 1 that are on-map (`1E46:0C7F == 0`): return 0 if the neighbour glyph is land-flagged (`63CE ≠ 0`) and not owned by the player, or is a city (class −1). Else return 1: **aboard a transport with no land or city alongside**.

## Empirata mapping

| DOS | Empirata |
|---|---|
| `12C2:115F` | none in the classic type step (conquest BFS is strategic, not adjacency) |
| `0x4A2A` attack mask | none; `classicSentryEngageTarget` handles sentry engagement only |
| Second mask turn-away | none |
| `12C2:0845` | none |

## Proposed engine change (not in this PR)

Add a classic type step after the picker: (1) army: adjacent non-own city → step in; (2) per-type attack mask from the table above → step onto the first enemy (directions 8 … 1); (3) ships: if the turn-away mask hits, set `dir = (dir + rand%3 + 3) & 7` before `classicResolveLegalDirection`. Gate the ship pair on the `62F4` analogue (default on). Tests: one per row of the mask table.
