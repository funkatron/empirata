# ALG-AI-001 army activation: reissue `0x1F238`, city task `0x1F454`, type step `0x1F376`

```text
RUN_ID: alg-ai-001-army-reissue-2026-11-26
TRACE_ID: alg-ai-001-army-reissue
IMAGE_SHA256: 145cfabac7ecac70c92a63539fb2d6a2b626e3249c44e5f4cc58ad43a922358b (227408)
FINDING: Type reissue 0x4462 calls 0x1F238 for armies (far call at 0x4478). Land armies: parity-gated
         city task (neutral, known, ≤ 12 on grade 1), 20-slot list, transport boarding, else wander 0x10.
         Every move ends in type step 0x1F376: adjacent non-own city, explore probe, attack mask, legalize.
EMPIRATA_GAP: closed by v0.7.3 (classic-army.ts) except the items marked [staged] below.
NOTES: 0x1F238-0x1F375; 0x1F454-0x1F5F3; 0x1F376-0x1F453 (from 0x47E0 at 0x4806); 0x4418 (order 0xF)
```

## 1. Reissue `0x1F238` [D]

```text
loc = 84E[u]; glyph = chart[loc]; 91B2 = −1
if class(glyph) == 3:                       // army on a transport
    order = 0x11
    if 12C2:0845(u): return
    if 0x1F454(u): return
    if 03BF:0C6E(u, &tmp): order 0x10, fresh heading      // explore probe as a gate
    return
if ((6D8E[p] ^ u) & 1) and 0x1F454(u): return              // city task on alternate turns
if 0x1F5F4(u): return                                      // 20-slot list → order 5
if 0x1F6AA(u): return                                      // board type-3 in order 0xE ≤ 10 → Sentry
if 91B2 >= 0: order 0xF, 24A = 91B2; return                // grade-2 fallback
if order != 0x10: order 0x10, 24A = 03BF:0C46()            // wander heading
```

Orders 0, 0x10 and 0x11 dispatch to status 1 (`0x3E00`), so a wandering army re-runs this chain on every activation.

## 2. City task `0x1F454` [D]

`start = rand() % 6384` (city count); visit every city once, wrapping. Skip when `0x51A[p][city] == 0` (unknown). Grade 1 (`62F6 == 0`): Chebyshev ≤ **12** (`0x1F59C`) and `1A9E:000C(armyLoc, cityLoc) ≠ 0` → order **0xF**, `24A = cityLoc`, return 1. Grade 2: ≤ 20 plus the per-city cap `(120 − 6368[p]) / 10` and the `91B2` write [staged].

`1A9E:000C` uses table `DS:2AD8`: the goal itself must pass, so only a **neutral** city can be a goal (player cities, own included, are blocked).

## 3. Order 0xF dispatch `0x4418` [D]

Status 1 (reissue) when `6C82[chart[goal]] == player` (captured) or `1A9E:000C(loc, goal) == 0` (unreachable, e.g. an enemy took it). Otherwise the picker `0x46FC` → `0x4714` steps toward the goal.

## 4. Army type step `0x1F376` [D]

1. `12C2:115F`: DOS directions 7 … 0 (`6300[d]`: E, NE, N, NW, W, SW, S, SE for d = 0 … 7); first neighbour glyph of class −1 (city) whose owner ≠ player → that direction.
2. `03BF:0C6E` (`0x485E`): explore probe, **direction used** here.
3. `0x4A2A(u, &dir, mask)` with mask `0xC0` if the army stands on a transport glyph, else `0xF0` (army, fighter, destroyer, transport).
4. Else, if the picker gave a direction: legalize with `0x4C52`. If it gave −1, legalize only when the army stands on a city glyph (class −1); otherwise stay.

## Empirata (v0.7.3)

| DOS | Empirata |
|---|---|
| Parity `(6D8E[p] ^ u) & 1` | `classicArmyCityTaskTurn`: `(round − 1) ^ unitParityBit` [? offset; unit index taken from the id parity used by `0x4C52`] |
| `0x1F454` | `classicArmyCityTask` (grade 1 exact; grade 2 radius only) |
| `2AD8` / `1A9E:000C` | `classicLandTable2AD8Passable`, `classicLandPath2AD8` (BFS, DOS budget) |
| `0x4418` | `classicArmyCityTaskActive` |
| `0x4714` path step | first step of the `2AD8` BFS [? tie-break] |
| `0x1F5F4` | not modelled [?] (writers of `0xD02` untraced) |
| `0x1F6AA` | `classicArmyPortEmbarkStep` [staged: adjacent transport from an owned city, not order-0xE transport ≤ 10] |
| `0x1F376` | `classicAdjacentForeignCityStep`, `classicArmyExploreStep`, `classicArmyAttackStep`, then `0x4C52` |
| Class-3 branch (army on transport) | not used: Empirata does not activate embarked armies |

## Campaign comparison (classic grade 1, standard density, 150 rounds)

Cities blue/red/neutral and unit count at round 150; `first` = round of the first capture.

| Layout / seed | main (v0.7.0) | v0.7.3 |
|---|---|---|
| continents 17 | first 56 · 17/1/46 · 115 | first 13 · 36/15/13 · 385 |
| continents 23 | first 17 · 23/23/18 · 174 | first 16 · 26/28/10 · 243 |
| continents 41 | first 18 · 11/6/47 · 169 | first 15 · 10/1/53 · 140 |
| islands 17 | first 20 · 3/5/56 · 23 | first 12 · 8/5/51 · 45 |
| islands 23 | first 16 · 5/2/57 · 38 | first 136 · 2/1/61 · 14 |
| islands 41 | first 52 · 2/5/57 · 21 | first 14 · 3/4/57 · 25 |

Faster expansion on most continent seeds; islands depend on transports, where `0x1F6AA` is still staged.
