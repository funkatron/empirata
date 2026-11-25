# ALG-AI-004 resign accept effects (`0xDF58`)

```text
RUN_ID: resign-accept-effects-2026-11-25
TRACE_ID: resign-accept-effects
IMAGE_SHA256: 145cfabac7ecac70c92a63539fb2d6a2b626e3249c44e5f4cc58ad43a922358b (227408)
FINDING: Accept crushes the computer immediately (0xD8F1 is -9999 signed) and ends a two-side game. All four city tallies, owner 0 included, are zeroed.
EMPIRATA_GAP: city-share test omits neutral cities; accept outcome (game over) already matches.
NOTES: 0xDF58-0xE1B4; caller 0xE83F in 0xE818; 0xE1B5 called from 0xEF0A (new-game setup); strings DS:1698/16AD/16DB/16F8 (DS base 0x2E320)
```

Corrects two points in `alg-ai-004-df58-crush-order-trace-2026-11-24.md`.

## 1. Accept [D]

| Offset | Effect |
|---|---|
| `0xE166–0xE178` | Dialog `1B1F:03BF`: text `DS:16AD` “The computer wishes\|to resign!\|Do you accept?”, buttons `DS:1698` “`A`ccept\|`C`rush Him” (2 buttons) |
| `0xE180` | `cmp ax,1` — button 1 is **Accept** |
| `0xE18A` | `tally[p] = 0` |
| `0xE18F` | `[bp-0x10] = 0xD8F1` = **−9999** as a signed word |
| `0xE199–0xE1AD` | `tally[p] == 0`, so jump to the army scan at `0xDFE7` with `[bp-0x10]` still −9999 |
| `0xDFAD–0xDFEF` | Scan units `6D9E−1 … 0`: count if `84E[u] != 0`, `17FA[u] == p`, `1AB2[u] == 0` (army). The count can never reach +9999 |
| `0xDFF1–0xDFF5` | `cmp [bp-0x10],0` / `jle 0xDFFA` — **taken** |
| `0xDFFA–0xE05C` | Crush: `638E[p] = 1`, `dec 6C7C`, optional sound (`645C`), “Player #%d has been CRUSHED!” (`DS:16DB`) with button “`G`REAT!” (`DS:16F8`) |
| `0xE05F–0xE0B6` | `8E24 = 1`. Cleared again only if `6C7C > 1` and (`646C == 0`, or a human is still alive). Resign requires `6C7C == 2`, so after the crush `6C7C == 1` and `8E24` stays **1** |

So accepting a resignation is an immediate crush and, because resign is only offered with two sides alive, the end of the game. This function does not change units or city owner bytes.

## 2. Crush Him (decline) [D]

`ax != 1` → `0xE194`. `4F8[p]` was already set to 1 at `0xE148`, so the offer never repeats. The player's tally is nonzero (the offer needs `cities + neutral < cityCount/4`, not 0), so no crush this turn.

## 3. `0xE1B5` [D]

Only caller `0xEF0A`, in game setup (after `1B1F:08F2`; failure path `1B1F:175F`). It clears `1098` and sets `E06 = −1` for 100 cities, then checks `6C7E` (player count) against `6384` (city count) and shows `DS:1706` “…map selected does not have enough cities.” Not related to resign or crush.

## 4. Owner-0 tally [D]

`0xDF5F–0xDF78`: `[bp-4] = 4`; loop `ax = [bp-4]--; if ax: [bp + 2*[bp-4] − 0xE] = 0`. Indexes 3, 2, 1, 0 are zeroed, so `[bp-0xe]` (owner 0) is **0** before the city count. The resign test therefore compares **(computer cities + neutral cities)** with `6384 >> 2` (`0xE12D–0xE142`).

## 5. Other fields seen

| Field | Evidence |
|---|---|
| `6D8E[p]` | `0xE853`: `inc` for the current player (`6CB4`) right after `call 0xDF58` in `0xE818`. Resign needs `> 100` → per-player turn counter |
| `17FA[u]` | Owner byte per unit (`0xDFC5`) |
| `1AB2[u]` | Type byte per unit (`0xDFD9`) |
| `8E24` | Game-over flag set by the crush branch |

## Empirata mapping

| DOS | Empirata |
|---|---|
| Gates `646C==1`, `6C7C==2`, `6D8E>100`, `4F8==0` | `shouldOfferClassicResign`: one human, two living factions, `round > 100`, `classicResignOffered` — match |
| `(cities[p] + cities[0]) < cityCount >> 2` | `classicResignCityShare` = `owned / cities.length < 0.25` — **omits neutral cities** and uses a real ratio instead of `floor(n/4)` |
| Accept → crush → game over | `respondClassicResign(accept)` transfers cities and removes units, then `gameOutcome` ends the game — same outcome |
| Crush Him | decline keeps the computer, offer flag set — match |

## Proposed engine change (not in this PR)

Change the resign city test to `computerCities + neutralCities < Math.floor(cities.length / 4)`. Do **not** change accept to keep the computer in play (the 2026-11-24 proposal was based on reading `0xD8F1` as positive). Optional: log “Player #N has been CRUSHED!” on accept.
