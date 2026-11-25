# ALG-AI-001 army strategic probes

> **Correction (2026-11-25):** `12C2:0845` tests class **3 = transport glyph** (army aboard a transport), not a city. `1A9E:000C` and `1E46:08A7` are now identified. See `alg-ai-001-army-predicates-trace-2026-11-25.md` and `alg-ai-001-contact-tables-trace-2026-11-25.md`.

```text
RUN_ID: army-strategic-1f454-2026-11-24
TRACE_ID: army-strategic-1f454
IMAGE_SHA256: 145cfabac7ecac70c92a63539fb2d6a2b626e3249c44e5f4cc58ad43a922358b (227408)
FINDING: 0x1F454 tasks one city within 20 or 12; 0x1F5F4 escorts the first of 20 map indexes within 12; 0x1F6AA sentries onto a type-3 unit in order 0xE within 10.
EMPIRATA_GAP: classicArmyConquestStep is a hostile-city BFS with no DOS radius or rand start. classicArmyPortEmbarkStep only boards an adjacent friendly transport from an owned city.
NOTES: 0x1F454-0x1F7B6; 12C2:0845 at 0x13465; predicates 1A9E:000C and 1E46:08A7 are [? ]
```

City count is `ES:6384`. Unit high-water is `ES:6D9E` (already [D]). Type 3 is transport (ruleset unit order). Order `0xE` is the transport order the empty-transport cleanup refuses to clear.

## `12C2:0845` (`0x13465`) [D]

Return 0 unless type byte is 0 and the army's chart glyph has class `6D44 == 3` (city class). Then scan `2E32:62FE` at indexes 9…1 (index 9 is the word `−1`; 8…1 are SE, S, SW, W, NW, N, NE, E). Off-map (`1E46:0C7F` ≠ 0) is skipped. Return 0 if `63CE[glyph] != 0` and `6C82[glyph] !=` player, or if class is `0xFF`. If the loop finishes, return 1.

## `0x1F454` city task [D]

Start at `rand() % 6384` and walk every city index once, wrapping to 0.

Skip a city when the word at `player*0xC8 + city*2` in the table based at `0x51A` is 0. City location is `19D8[city]`.

| `ES:62F6` | Distance | Extra |
|---|---|---|
| ≠ 0 | Chebyshev ≤ **0x14 (20)** (`0x1F4E3`) | `1A9E:000C` ≠ 0, and the `0x51A` word `< (0x78 − player 6368) / 10`. Then increment that word, set `DS:91B2` to the city loc |
| == 0 | Chebyshev ≤ **0x0C (12)** (`0x1F59C`) | `1A9E:000C` ≠ 0. No cap, no `91B2` write |

Success: order byte **`0x0F`**, `ES:24A` = city map index, return 1. The stored word is a location, so the order-`0xF` picker `0x46FC` pathfinds when it is `> 7`. Full cycle with no hit returns 0.

`1A9E:000C` is not `1A9E:006C`. What it tests is **[?]**.

## `0x1F5F4` twenty-slot list [D]

Per-player array at `0xD02 + player*0x28`, 20 words (`SI` compared to `0x14` at `0x1F699`). First nonzero word with Chebyshev ≤ **12** and `1A9E:004C` ≠ 0: order **5** (Escort), `ES:24A` = that word, return 1. No `rand`. Slot meaning beyond "map index passed to Chebyshev" is **[?]**.

## `0x1F6AA` type-3 / order `0xE` [D]

Start at `rand() % 6D9E`, scan every unit once. Require order byte `0xE`, type byte **3**, `84E[unit] != 0`, `1E46:08A7(unit)` ≠ 0, and Chebyshev(`84E[unit]`, army loc) ≤ **10** (`0x1F750`).

On hit: that unit's `24A` becomes the army's location; the army's order becomes **1** (Sentry) and its `24A` becomes the scanned unit index. `1E46:08A7` is **[?]**.

## Empirata mapping

| DOS | Empirata |
|---|---|
| `0x1F454` | `classicArmyConquestStep` walks every charted hostile city, no 20/12 cap, no random start, no `0x51A` counter, and steps immediately instead of writing order `0x0F` |
| `0x1F5F4` | no 20-slot escort list |
| `0x1F6AA` | `classicArmyPortEmbarkStep` steps onto a friendly transport at distance 1 from an owned city. It does not set Sentry or accept distance 10 |
| `12C2:0845` | none |

## Proposed engine change (not in this PR)

Do not replace `classicArmyConquestStep` until `1A9E:000C` is identified. The shape, once that predicate is known: one random-start pass over cities, accept the first inside 20 or 12, write a move-to of that city, and keep a per-city assign count capped by `(120 − playerWord) / 10` when `62F6` is set. Embark stays a separate change: order `0xE` transports within 10 whose `08A7` passes, then sentry the army on that unit index.
