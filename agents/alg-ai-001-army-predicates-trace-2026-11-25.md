# ALG-AI-001 army predicates (`1A9E:000C`, `1A9E:004C`, `1E46:08A7`, `0x51A`, `62F6`)

> **Correction (2026-11-26):** `62F2`, `62F4` and `62F6` are not options with default 1. They are grade-B flags `62E8[5…7]`, rewritten by `0xF40F` on every computer turn: **0 on grade 1** (Empirata's default), 1 on grade 2. See `alg-ai-003-mode-flags-trace-2026-11-26.md`.

```text
RUN_ID: army-predicates-2026-11-25
TRACE_ID: army-predicates
IMAGE_SHA256: 145cfabac7ecac70c92a63539fb2d6a2b626e3249c44e5f4cc58ad43a922358b (227408)
FINDING: 1A9E:000C/002C/004C/006C are one pathfinder (0x1AA6C) with four passability tables; 1E46:08A7 = unit alive and own; 0x51A is a per-player per-city weight; 62F6 is an option word (default 1).
EMPIRATA_GAP: classicArmyConquestStep has no 20/12 radius, no random start, no per-city cap; passability sets differ by caller.
NOTES: wrappers 0x1A9EC/0x1AA0C/0x1AA2C/0x1AA4C; 0x1AA6C; lookups 0x1ACE0, 0x1AE87; tables DS:2AD8/2AFA/2B1C/2B3E; 0x1ED07; 0x51A writers below
```

## 1. Pathfinder wrappers [D]

| Entry | Linear | Table pushed |
|---|---|---|
| `1A9E:000C` | `0x1A9EC` | `DS:2AD8` |
| `1A9E:002C` | `0x1AA0C` | `DS:2AFA` |
| `1A9E:004C` | `0x1AA2C` | `DS:2B1C` |
| `1A9E:006C` | `0x1AA4C` | `DS:2B3E` |

Each pushes `(from, to, table, DS:0xED6 out-ptr)` and calls `0x1AA6C`: store table in `919A`, goal in `919E`, chart `234 + 6444[player]` in `9190`; if `from == goal` cost 0; else search `0x1AF98` with radius `min(2·dist + 0x19, 0x7D)`. Return `cost + 1`, or 0 when cost ≥ 10000. The tile test (`0x1ACE0`, `0x1AE87`) is `table[glyph] != 0` — **glyph only**; no `player*0x22` term on this path (ruleset row flagged for re-check).

### Passable glyphs (labels from `alg-ai-001-contact-tables-trace-2026-11-25.md`)

| Table | Passable | Reading **[?]** |
|---|---|---|
| `2AD8` (`000C`) | 0, 1, 3, armies, fighters over land (all players) | land incl. unexplored and neutral cities; **player cities blocked** |
| `2AFA` (`002C`) = `2B1C` (`004C`) | 1, 3, all player cities, armies, fighters over land | known land incl. every city |
| `2B3E` (`006C`) | 0, 2, fighters over sea | sea incl. unexplored |

Because the goal must pass the same test, `1A9E:000C` can only reach a **neutral city** (glyph 1) or unexplored/land goal. So `0x1F454` tasks armies to neutral cities reachable over land **[D for the bytes; the glyph labels are [?]]**.

## 2. `1E46:08A7` (`0x1ED07`) [D]

`return 84E[u] != 0 && 17FA[u] == 6CB4` — the unit exists and belongs to the current player. In `0x1F6AA` it validates the type-3 transport (order 0xE) before the army boards it.

## 3. Table `0x51A` [D] for writers

Per player × city word: `0x51A + player*0xC8 + city*2` (100 cities).

| Writer | Effect |
|---|---|
| `0xF0D2`, `0x19809` | set 0 |
| `0x1EA21` | set **1** (sight chain, `0x1EA0B`: player `[bp+8]`) — city becomes known |
| `0x33FD` | `+1` if nonzero (city from `1E46:0081(loc)`) |
| `0x3478`, `0x1DC2E` | `+= 12C2:0DAD(...)` if nonzero |
| `0x1F55C` | `+1` when `0x1F454` tasks an army to the city |

Readers include `0x1F4B0` (skip unknown city), `0x1F538` (cap `< (0x78 − 6368[p]) / 10`), `0x1DAAE`, `0x1E975`. Reading **[?]**: 0 = unknown; ≥ 1 = known, plus accumulated attention/assigned weight.

## 4. `62F6` [D] partial

Initial value **1** (`DS:62F6`). Only reads in code (`0x1DB8F`, `0x1F4CC`); no direct store found. Same for `62F2` and `62F4` (both default 1). Likely options set through a pointer table or save load **[?]**. With the default, `0x1F454` uses radius **20** and the cap.

## Empirata mapping

| DOS | Empirata |
|---|---|
| `0x1AA6C` + table | `classicUnitReachableGoal` (one passability rule per unit kind) |
| `000C` land-to-neutral-city | `classicArmyConquestStep` targets any charted hostile city, no radius |
| `0x51A` cap | none |
| `1E46:08A7` | owner/alive check in `classicArmyPortEmbarkStep` |

## Proposed engine change (not in this PR)

Rewrite army city tasking as `0x1F454`: random-start pass over known cities; accept the first **neutral** city within 20 (option default) whose per-city counter is under `(120 − X) / 10` (`6368[p]` analogue **[?]**) and that is reachable over land/unexplored; increment the counter; store a move-to. Leave enemy-city attacks to the contact step (`12C2:115F`). Needs `6368` identified first.
