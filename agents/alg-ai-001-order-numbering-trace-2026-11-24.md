# ALG-AI-001 order numbers vs picker table

> **Update (2026-11-25):** order `0xC` is computer ship escort, not Wait; see `alg-ai-001-wait-order-0xc-trace-2026-11-25.md`.

```text
RUN_ID: order-numbering-check-2026-11-24
TRACE_ID: order-numbering-check
IMAGE_SHA256: 145cfabac7ecac70c92a63539fb2d6a2b626e3249c44e5f4cc58ad43a922358b (227408)
FINDING: String-table Escort is order 5 (picker 0x46FC). Picker slot 12 (order 0xC) is 0x4600, not order 5.
EMPIRATA_GAP: classicEscortCloseRangeGoal implements 0x4600 on the player escort order. DOS order 5 does not call 0x4600.
NOTES: names 0x2FD7B; dispatch 0x3E54; picker 0x451C; 0x46FC; 0x400E owner test 0x403C
```

CS for both jump tables is `0x3BF0`. `0x44EA` does `order − 1`, rejects `> 0x10`, then `jmp cs:[bx+0x92C]` (table file `0x451C`).

## Names [D]

Consecutive C strings at `0x2FD7B`:

| Order | Bytes |
|---|---|
| 0 | `None` |
| 1 | `Sentry` |
| 2 | `Random` |
| 3 | `Move To ` |
| 4 | `Land on ` |
| 5 | `Escort ` |
| 6 | `Patrol from ` |
| 7 | `Move ` |
| 8 | `Load ` |
| 9 | `Armies` |
| 10 | `Fighters` |
| 11 | `Patrol ` |
| 12 | ` - ` |

`Armies` / `Fighters` / `Patrol ` / ` - ` sit in the same run of strings. Whether 9–12 are the names the game prints for those order bytes is **[?]**: nothing in this trace indexes the table. Menu `Wait` is a different string at `0x3056F`.

## Dispatch stubs (`0x3E54`, 18 words) [D]

| Order | Stub | Calls |
|---|---|---|
| 0, 0x10, 0x11 | `0x3E00` | `mov ax,1` (status, not a direction) |
| 1 | `0x3E06` | `0x3E7C` |
| 2 | `0x3E0C` | `0x3F0C` |
| 3 | `0x3E12` | `0x3F64` |
| 4, 5, 7 | `0x3E18` | `0x400E` |
| 6 | `0x3E1E` | `0x3F9A` |
| 8 | `0x3E24` | `0x4086` |
| 9 | `0x3E2A` | `0x40E4` |
| 0xA | `0x3E30` | `0x4152` |
| 0xB | `0x3E36` | `0x41C0` |
| 0xC | `0x3E3C` | `0x421E` |
| 0xD | `0x3E42` | `0x424A` |
| 0xE | `0x3E48` | `0x42BC` |
| 0xF | `0x3E4E` | `0x4418` |

## Picker stubs (`0x451C`, 17 words, orders 1…0x11) [D]

| Orders | Stub | Function |
|---|---|---|
| 1, 6 | `0x44FE` | `0x45E4` — push `84E[8AD6]`, `call 0x4714` |
| 2, 3 | `0x450A` | `0x45A2` — `0x4C52` on the heading |
| 4, 5, 7–0xB, 0xD–0xF | `0x4510` | `0x46FC` |
| 0xC | `0x4504` | `0x4600` |
| 0x10 | `0x4516` | `0x4542` wander step |
| 0x11 | falls through `0x453E` | return **−1** |

`0x46FC`: if `8AD6 <= 7`, `call 0x45A2` (heading). Else push `8AD6` and `call 0x4714` (that word is a map index).

## Order 5 vs `0x4600` [D]

`0x400E` (dispatch for 4, 5, and 7):

- If `8AD6 == 8AD8` (goal word equals unit loc), return status 1.
- Fighter: Chebyshev(`8AD6`, `8AD8`) `>` fuel → status 1, else status 0.
- If order byte `8ADA == 5`: `6C82[chart[8AD6]]` compared to the player id; **equal → status 1** (`je 0x4032`). The ruleset line that said the escort aborts when the owner is **not** the player had the test backwards.
- Else `1A9E:006C(8AD6, 8AD8)`; status is 1 when the call returns 0 and 0 when it returns ≥ 1.

Computer stores of order **5** (`0x1F5F4`, `0x1F9DF`) write a location or unit index into `ES:24A`. They do not call `0x4600`. `0x4600` runs only when the **picker** sees order **0xC**.

Writers of order `0xC` (`0x1D7E1`, `0x1DDF1`) also store a word into `24A` (unit index at `0x1D7FB`, `SI` at `0x1DE01`). Wake-set membership `{1, 6, 0xC}` is unchanged. The string at name-slot 12 is ` - `, so calling order `0xC` "Wait" still rests on the menu string plus those writers, not on this name table. **[?]** whether the menu Wait key is what executes `0x1D7E1`.

## Empirata mapping

| DOS | Empirata |
|---|---|
| Order 5 picker `0x46FC` | Not separated. `classicEscortStep` / `classicEscortCloseRangeGoal` follow `0x4600` whenever the unit's order kind is `escort`. |
| Order `0xC` picker `0x4600` | No `skip` / Wait path calls `classicEscortCloseRangeGoal`. |
| `classicTacticalReissueOrder` | Leaves `escort`, `move-to`, and `go-home` alone. It does not know DOS order 5 vs `0xC`. |

## Proposed engine change (not in this PR)

Treat player escort as order 5: if the stored goal word is `<= 7`, legalize it as a heading; otherwise path to that map index (`0x4714`). Run `0x4600` only for the order Empirata maps to DOS `0xC` (today `skip`, if that is the Wait byte — confirm before coding). Fix the owner test to abort when the decoded owner **equals** the player.
