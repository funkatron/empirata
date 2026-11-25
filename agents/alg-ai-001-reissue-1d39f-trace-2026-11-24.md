# ALG-AI-001 carrier reissue `0x1D39F` (`n=10`)

```text
RUN_ID: reissue-1d39f-2026-11-24
TRACE_ID: reissue-1d39f
IMAGE_SHA256: 145cfabac7ecac70c92a63539fb2d6a2b626e3249c44e5f4cc58ad43a922358b (227408)
FINDING: The n=10 call of 1D09:03C2 is the carrier reissue path (type 6), and only when 180C is negative and the nearest friendly city is farther than 10.
EMPIRATA_GAP: Empirata never calls the station probe with n=10.
NOTES: type table 0x44B2; call 0x449E; body 0x1D29E-0x1D3C5
```

`0x4462` jumps through `cs:[type*2+0x8C2]` (file `0x44B2`). Type **6** (carrier) is the only slot that calls `1D09:020E` (`0x449E` → `0x1D29E`). Type 3 (transport) calls `1D09:0004` instead. Types 2, 4, 5, and 7 share `1D09:0116`.

## When `0x1D39F` runs [D]

Inside `0x1D29E`, after an optional `call 0x1D6AA` (only if `504[player] != 0` and `17F6[unit] < 5`):

1. If `180C[unit] >= 0`, skip the city scan (`jmp 0x1D3C8`).
2. If `180C[unit] < 0`, walk cities from `6384` down. Keep a city when owner byte `1098` equals the current player and `E06[city] == 1`. Distance is `1E46:0957` against the carrier's `84E` loc. Best distance starts at `0x270F`.
3. If that best location is 0, or the best distance is `<= 10` (`cmp di, 0xA; jle`), do not call `0x1D452`.
4. Otherwise push `n = 10`, the city loc, and the carrier loc, and `call 0x1D452` (the same 20-probe routine as escort, with a 21×21 window).
5. Nonzero return: order byte **`0xA`**, and `0x1D449` stores AX into `ES:24A`.

If the probe is skipped or returns 0, `call 0x1DE2A`. Nonzero there also sets order `0xA` and returns without the `24A` store in this block. What `0x1DE2A` returns is **[?]**.

## Empirata mapping

| DOS | Empirata |
|---|---|
| Carrier, `180C < 0`, city farther than 10 | no caller passes radius 10 to `classicEscortStationCandidates` |
| Order `0xA` | not a standing-order kind |

## Proposed engine change (not in this PR)

On a classic carrier whose `180C` analogue is negative, search owned cities with the `E06==1` flag, and if the nearest is farther than 10, run the existing 20-probe window with `n=10` and store order `0xA` plus the returned tile. Leave escort's `n=3` call alone.
