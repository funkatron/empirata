# ALG-AI-001 north-rim None unit — static answer

```text
RUN_ID: 4c52-rim-runtime-2026-11-24
TRACE_ID: 4c52-rim-runtime
IMAGE_SHA256: 145cfabac7ecac70c92a63539fb2d6a2b626e3249c44e5f4cc58ad43a922358b (227408)
FINDING: A None unit does not stay because it is on the north rim. 0x44EA returns -1 only while the order is still 0; reissue rewrites that order before the picker. 0x4542 is the army wander step, not a rim rule.
EMPIRATA_GAP: none in 0x4C52. The old rim heuristic has no DOS counterpart (compass trace Q5).
NOTES: 0x44EA order 0 → 0x453E; 0x4542 only for order 0x10; 0x4C52 has no Y compare. DOSBox was not run.
```

## What the bytes do [D]

`0x4C52` tries up to 8 directions and writes `−1` on exhaust. It never compares X or Y. A blocked northern neighbor is just one failed probe.

`0x44EA` returns `−1` immediately when the order byte is 0 (the `sub ax,1` underflows the `cmp ax,0x10` / `ja`). That stay happens only if the order is still None when the picker runs.

It is not still None. Order 0's dispatch is `mov ax,1`, so `0x4462` runs first:

| Type | Reissue | Picker after that |
|---|---|---|
| Army in a city that does not explore | order `0x11` | `0x453E` stay |
| Army in the open, no strategic hit | order `0x10` + `0x4836` heading | **`0x4542`** (three steps back, then `0x4C52`) |
| Ship or fighter | order **3** + `0x4836` heading | `0x3F64` Random, then `0x45A2` (`0x4C52`) |

`0x4542` is selected by picker index 15 (order `0x10`), not by the map edge. A north-rim ship wanders: 1-in-16 ring step, then `0x4C52` from that heading. If all 8 neighbors fail, the direction becomes `−1` and that activation does not move. The rim is not why.

## DOSBox

Not run. A live save is not required to answer the stay-vs-wander question; the picker table already does. A DOSBox run would only show the same reissue on one unit.

## Empirata mapping

| DOS | Empirata |
|---|---|
| No rim test in `0x4C52` | `classicRimAwarePreferredIndex` was the extra heuristic. It should stay out. |
| Ship None at `y=1` | After reissue, same path as any other order-3 ship: Random tick, then `classicResolveLegalDirection`. |
| Army None in the open | `classicArmyWanderStep` (`0x4542`), including on the rim. |

## Proposed engine change

None. Do not add a north-rim special case.
