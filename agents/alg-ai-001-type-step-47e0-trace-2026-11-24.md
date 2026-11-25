# ALG-AI-001 type step `0x47E0`

> **Update (2026-11-25):** ship masks are in DS (`DS:4BD0`, `DS:4BDC`), decoded in `alg-ai-001-contact-tables-trace-2026-11-25.md`.

```text
RUN_ID: type-step-47e0-2026-11-24
TRACE_ID: type-step-47e0
IMAGE_SHA256: 145cfabac7ecac70c92a63539fb2d6a2b626e3249c44e5f4cc58ad43a922358b (227408)
FINDING: 0x47E0 only branches on unit type. Each callee can replace the direction, and all three leave -1 in place unless a contact probe already wrote a heading.
EMPIRATA_GAP: no adjacent class-0xFF steer, no masked neighbor attack 0x4A2A, no ship rand nudge before 0x4C52.
NOTES: 0x47E0-0x4835; army 0x1F376; fighter 0x1FE56; ship 0x1D50E-0x1D6A8; 12C2:115F at 0x13D7F; 0x4A2A
```

`0x47E0` reads `8AD0` and calls one far routine with `(unit, direction pointer, extra pointer)`, then returns. Type 0 → `1F23:0146` (`0x1F376`). Type 1 → `1F23:0C26` (`0x1FE56`). Types 2…7 → `1D09:047E` (`0x1D50E`). Anything else returns without a call.

## Shared probes [D]

**`12C2:115F` (`0x13D7F`)** — directions 8 down to 1. Neighbor chart glyph whose class byte `6D44` is `0xFF` and whose `6C82` owner byte is not the player: write that direction, return 1. Otherwise 0. Direction 0 is not scanned.

**`03BF:0E3A` (`0x4A2A`)** — same 8…1 scan of `2E32:6300`. Skip the neighbor when `6C82[glyph] ==` player or `6D44 < 0`. A hit also needs `(DS:6464[class] & mask) != 0`. If class is 1: type 0 rejects a nonzero `6CD6` (sea-class) glyph; types ≥ 2 reject a nonzero `63CE` glyph. A hit writes the direction and returns 1.

**`03BF:1062`** is `0x4C52`. **`03BF:0C6E`** is the explore probe `0x485E`.

## Army `0x1F376` [D]

1. `12C2:115F` nonzero → return (direction already written).
2. Else `0x485E` nonzero → return.
3. Else mask = `0xC0` when the unit's own chart class is 3, else `0xF0`. `0x4A2A` with that mask nonzero → return.
4. Else if the direction word is `−1` and the unit's chart class is not `0xFF`, return **without** `0x4C52`.
5. Else `call 0x4C52`.

## Fighter `0x1FE56` [D]

1. `0x4A2A` with mask `0xFF`. Nonzero → return.
2. Else if order byte ≠ 2: fuel threshold 14 or 10 from the sign of `180C`, compared to `163C`. Below the threshold, skip the explore probe.
3. Explore probe `0x485E`. Nonzero → return.
4. If direction is `−1`, return. Else `0x4C52`.

## Ship `0x1D50E` [D] for control flow

1. Two `0x4A2A` calls (masks from words at `0x4BD0[type-2]` and `0x4BDC[type-2]`). The second success does `dir = (dir + rand%3 + 3) & 7` (`0x1D67A` and the earlier copy at `0x1D582`).
2. `call 0x1DF56` (eight-direction helper). Nonzero → return.
3. Order byte `0x8`, or `0xB` on type 3, or type 6 with `180C >= 0`: skip the explore probe.
4. Direction `−1` → return (`0x1D61E`), no `0x4C52`.
5. Else explore probe; nonzero → return.
6. If `ES:62F4 == 0`, two more `0x4A2A` calls. A success of the second again adds `rand%3+3` to the direction.
7. Then `0x4C52`, unless an earlier success already returned.

What `0x1DF56` accepts (sea class vs chart) is the earlier eight-direction note; this trace does not reopen it. The mask words at `0x4BD0` / `0x4BDC` were not decoded. **[?]** which ship types those masks correspond to beyond `type-2`.

## Empirata mapping

| DOS | Empirata |
|---|---|
| Final `0x4C52` | `classicResolveLegalDirection` |
| `0x485E` | `classicCityArmyExploreProbe` (army-in-city gate only; not called from the ship/fighter step) |
| `12C2:115F`, `0x4A2A`, ship `rand%3+3` | none |

## Proposed engine change (not in this PR)

After a heading is chosen and before `classicResolveLegalDirection`, scan DOS directions 8…1 for a chart cell with class `0xFF` not owned by the player and take that step (`12C2:115F`). A second PR can add `0x4A2A` once `6464` and the ship mask words are tabulated. Do not legalize a direction that is already `−1` for fighters and ships.
