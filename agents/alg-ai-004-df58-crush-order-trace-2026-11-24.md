# ALG-AI-004 `0xDF58` crush order

> **Correction (2026-11-25):** `0xD8F1` is −9999 signed, so **accept crushes the computer** (game over), and the owner-0 tally **is** zeroed. See `alg-ai-004-resign-accept-effects-trace-2026-11-25.md`.

```text
RUN_ID: resign-df58-2026-11-24
TRACE_ID: resign-df58
IMAGE_SHA256: 145cfabac7ecac70c92a63539fb2d6a2b626e3249c44e5f4cc58ad43a922358b (227408)
FINDING: Crush runs only after a zero city tally and a zero army scan. Resign is offered first, and accept uses sentinel 0xD8F1 so this function does not mark the computer crushed.
EMPIRATA_GAP: accept removes every computer unit immediately. DOS 0xDF58 does not.
NOTES: 0xDF58-0xE1B4; strings at 0x2F9DA and 0x2FA0F
```

## Per-player order [D]

City tallies: owners 1, 2, and 3 are zeroed (`[bp-0xc]`, `[bp-0xa]`, `[bp-8]`). Owner 0's slot `[bp-0xe]` is **not** zeroed, then incremented for every city whose `1098` byte is 0. **[?]** whether that slot is always 0 on entry.

Players run from 1 through `6C7E`. A player with `638E != 0` is skipped.

1. **Computer** (`63C0 == 0`) hits the resign gates before any crush test. **Human** (`63C0 != 0`) jumps to step 3.
2. Resign, all required: `646C == 1`, `6C7C == 2`, `6D8E[p] > 0x64`, `4F8[p] == 0`, and `cities[p] + [bp-0xe] < cityCount >> 2` (two `sar`). Then `4F8=1` and dialog `1B1F:03BF` on “The computer wishes|to resign!|Do you accept?” (`0x2F9DA`). Accept (`ax==1`) zeros the city-tally local and sets `[bp-0x10] = 0xD8F1`. Decline falls through with the real tally. Either way `4F8` stays 1.
3. If the city tally is not 0, next player. Nobody with a counted city is crushed here.
4. If the tally is 0, scan units from `6D9E` down. Count type **0**, owner equal to the player, `84E != 0`, into `[bp-0x10]`.
5. If that count is `> 0`, next player. The accept sentinel `0xD8F1` makes this true even when the scan finds no armies, so **accept does not take the crush branch**.
6. If the count is `<= 0`: `638E[p] = 1`, `dec 6C7C`, then the crushed string “Player #%d has been CRUSHED!” (`0x2FA0F`) via `25E6:09CE` and `1B1F:03BF`. `DS:8E24` is set to 1, then cleared again when `6C7C <= 1`, or when `646C == 0`, or when no still-active human (`63C0 != 0` and `638E == 0`) was seen in players 1…3.

This function does not delete units or rewrite city owner bytes. The routine at `0xE1B5` (next `push bp`) clears `1098` and sets `E06` to `−1` for 0x64 cities; it is not called from `0xDF58`.

## Empirata mapping

| DOS | Empirata |
|---|---|
| Resign before crush, only for a computer that still has the offer flag clear | `shouldOfferClassicResign` runs from the classic executor, not from an elimination pass |
| Crush only with 0 cities and 0 armies, and it only sets `638E` | `gameOutcome` finishes when the computer has no cities and no units |
| Accept zeros a local tally and skips the crushed dialog | `respondClassicResign` transfers cities and removes every computer unit immediately |

## Proposed engine change (not in this PR)

On accept, do not delete units inside the dialog handler. Leave the computer in play with `classicResignOffered` set, and let the existing elimination check fire only when that side has no cities and no armies. Do not show a crushed message on the accept path.
