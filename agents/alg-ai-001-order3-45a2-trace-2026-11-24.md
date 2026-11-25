# ALG-AI-001 order 3 picker `0x45A2`

```text
RUN_ID: order3-picker-45a2-2026-11-24
TRACE_ID: order3-picker-45a2
IMAGE_SHA256: 145cfabac7ecac70c92a63539fb2d6a2b626e3249c44e5f4cc58ad43a922358b (227408)
FINDING: Order 3's picker legalizes the current heading with 0x4C52; its dispatch is Random for every non-fighter.
EMPIRATA_GAP: classicIdleNoneStep ships/fighters legalize the heading but never run the rand%16 turn first.
NOTES: 0x45A2-0x45E2; 0x3F64-0x3F99; 0x3F0C-0x3F63; string "Move To " at 0x2FD8E
```

## 1. What `0x45A2` returns [D]

No path goal and no call to `0x4714` or `0x4C52`'s caller-side rotation beyond what `0x4C52` itself does.

| Offset | Effect |
|---|---|
| `0x45A9` | Local copy of `DS:8AD6` (current `ES:24A` heading) |
| `0x45B9` | `call 0x4C52` with that local and unit index `DS:8AD2` |
| `0x45C1` | If AX ≠ 0, store the local back to `ES:24A[unit]` and `8AD6` |
| `0x45DB` | `retf` with AX = that local (a direction `0…7`, or `−1` if `0x4C52` exhausted) |

`0x4714` is the other picker, `0x45E4`, used by orders 1 and 6.

## 2. Dispatch `0x3F64` vs the picker [D]

Activation order is dispatch, then optional `0x4462`, then `0x44EA`. For order 3 the picker stub is `0x450A` → `0x45A2` (table `0x451C`, index `order−1` = 2).

`0x3F64`:

- Type word `8AD0 == 1` (fighter) only: if `180C[unit] >= 0` the fuel threshold is **14**, else **10**. If `8ACE` (fuel) `<=` that threshold, return status **1** and do **not** call Random. Status 1 forces `0x4462` before the picker still runs.
- Every other type, and a fighter that passed the fuel test, `call 0x3F0C`.

`0x3F0C` [D] (same routine as order 2): if `1E46:0C7F(loc + delta[dir])` is nonzero, return status 1. Else `rand() % 16`; if the remainder is 0, `dir = (dir + 8ADC) & 7` written to `ES:24A` and `8AD6`. Return status 0.

So a ship on order 3 does wander like Random on each activation: a 1-in-16 ring step, then `0x45A2` legalizes whatever heading that left. It does **not** use the army wander step `0x4542` (the three-back probe).

## 3. Is the name "Move To"? [D] for the string, [D] for the behavior

Null-terminated names at `0x2FD7B`: 0 `None`, 1 `Sentry`, 2 `Random`, 3 `Move To `, 4 `Land on `, 5 `Escort `, 6 `Patrol from `, 7 `Move `.

Order 3's bytes are the Random fall-through plus a heading legalize. The only `mov byte ptr es:[reg], 3` sites that are unit orders are the idle writers already listed (`0x1D187`, `0x1D27F`, `0x1D433`, `0x1F946`). `0x16ADA` writes **3** into chart `ES:234` in a countdown from `0x1770`, not into an order byte. The human key that selects menu "Move To" was not located; do not treat the menu letter as traced.

Order 7, string `Move `, is the dispatch that shares `0x400E` and the picker `0x46FC` (path when `8AD6 > 7`). That is the path-follow order, not order 3.

## Empirata mapping

| DOS | Empirata (PR #192 `classicIdleNoneStep`) |
|---|---|
| Non-army idle heading | `classicWanderHeadingRoll` (`0x4836`) |
| `0x45A2` | `classicResolveLegalDirection` — this **is** the `0x4C52` sweep. The open `[?]` in that comment can close for the picker itself. |
| `0x3F64` → `0x3F0C` before the picker | **Missing.** Idle ships/fighters do not take the `rand%16` turn, and a low-fuel fighter does not return status 1 from this gate (reissue uses a different fuel check). |

## Proposed engine change (not in this PR)

In the non-army branch of `classicIdleNoneStep`, before `classicResolveLegalDirection`: draw `nextRandom15`; if `value % 16 == 0`, step the stored DOS heading by `classicRandomRotationBias`. If the neighbor in that heading is off-map, skip the step and leave reissue to the existing fuel/home path. Do not send order-3 units through `classicArmyWanderStep`.
