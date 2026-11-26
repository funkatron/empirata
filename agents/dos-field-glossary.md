# DOS field glossary (Interstel EMPIRE 2.05 image)

Fields named by trace evidence. **[D]** = writer and reader cited; **[?]** = meaning inferred. Offsets are DS-relative (data segment `2E32`, image base `0x2E320`) unless a linear address is given. Per-unit arrays are far pointers stored at the named offset (`les bx, es:0x84E`).

Add rows as traces confirm them; cite the trace note.

## Per unit

| Field | Meaning | Evidence | Status | Note |
|---|---|---|---|---|
| `84E[u]` (word) | map location; 0 = unit slot empty / dead | `0xDFB6`, `0x1ED14`, `0x421E` | [D] | resign-accept, army-predicates |
| `14E6[u]` (byte) | order byte | `0x1D7E1`, `0x1DF0A`, `0x4171` | [D] | wait-order-0xc |
| `24A[u]` (word) | heading 0…7, or goal location (order 5 / 0xA / 0xF), or unit index (order 0xC, Sentry target) | `0x1D7FB`, `0x1DE01`, `0x1DF1A`, `0x1F9F5` | [D] | wait-order-0xc |
| `17FA[u]` (byte) | owner (player 1…3) | `0xDFC5`, `0x1D711`, `0x1ED23` | [D] | resign-accept |
| `1AB2[u]` (byte) | unit type 0 army … 7 battleship | `0xDFD9`, `0x1D72B`, `0x1DE54` | [D] | resign-accept |
| `17F6[u]` (word) | escort strength assigned to this unit | `0x1D6BB`, `0x1D81A` | [D] write / [?] meaning | wait-order-0xc |
| `163C[u]` (byte) | value added per escort; fighters compare it with `91B4` | `0x1D802`, `0x1F9B7` | [?] | wait-order-0xc |
| `180C[u]` | sign gates fighter fuel 14/10 and carrier city scan | earlier notes | [?] | order3-45a2, reissue-1d39f |

## Per player

| Field | Meaning | Evidence | Status | Note |
|---|---|---|---|---|
| `6CB4` (byte, global) | current player | many | [D] | — |
| `63C0[p]` | nonzero = human | `0xE0EF` | [D] | resign-accept |
| `638E[p]` | crushed | `0xE003` | [D] | resign-accept |
| `4F8[p]` | resign already offered | `0xE125`, `0xE148` | [D] | resign-accept |
| `6D8E[p]` | turn counter (inc in `0xE818` after `0xDF58`) | `0xE853` | [D] | resign-accept |
| `6444[p]` | offset of player's chart from `234` | `0x4A59`, `0x1AA9C` | [D] | contact-tables |
| `0x51A + p*0xC8 + city*2` | city known (≥1) plus attention / tasked weight | writers listed in note | [D] write / [?] meaning | army-predicates |
| `0x5A + p*0x3C + type*0xA` | 5 most-recent enemy sightings per type | `0x1EB32` | [D] | carrier-1de2a |
| `0xD02 + p*0x28` | 20-slot hostile sighting ring | ALG-AI-002 | [D] | ruleset |
| `6368[p]` | combat efficiency (default 50, ruleset ALG-002); grade-2 tasking cap `(0x78 − 6368[p]) / 10` | `0x1F538`, `0xDEA9`; init `0xF342` | [D] | army-strategic |

## Per city

| Field | Meaning | Evidence | Status |
|---|---|---|---|
| `1098[c]` (byte) | owner (0 neutral) | `0xDF8E`, `0xE1CB` | [D] |
| `E06[c]` | set −1 at new game | `0xE1DA` | [?] |
| `19D8[c]` | location | army-strategic | [D] |

## Global

| Field | Meaning | Evidence | Status |
|---|---|---|---|
| `6384` | city count | `0xDF7E` | [D] |
| `6D9E` | unit high-water | `0xE1A6` | [D] |
| `6C7E` (byte) | number of players | `0xE0C3`, `0xE1EF` | [D] |
| `6C7C` | players still alive | `0xE00E` | [D] |
| `646C` | 1 = one human (resign gate); 0 = no humans | `0xE0A8`, `0xE0FE` | [?] |
| `8E24` | game over | `0xE05F`, `0xE0B6` | [D] |
| `645C` | sound on | `0xE017` | [?] |
| `62F2` | grade-B flag `62E8[5]` (0 on grade 1): set → order 0xC releases only when the target dies; 0 → reissue every activation and `0x1D1A6` attaches escorts | `0x4224`, `0x1D231`; writer `0xF40F` | [D] |
| `62F4` | grade-B flag `62E8[6]` (0 on grade 1): ship contact masks; 0 → `0x4B52` returns 1 at once | `0x4B5F`, `0x1D530`, `0x1D637`; writer `0xF40F` | [D] |
| `62F6` | grade-B flag `62E8[7]` (0 on grade 1): army city tasking radius 20 + cap, else 12 and no cap | `0x1F4CD`, `0x1DB90`; writer `0xF40F` | [D] |
| `91B4` | fighter range compared with distance and `163C` | `0x1F9AD` | [?] |

## Chart glyphs

See `alg-ai-001-contact-tables-trace-2026-11-25.md` §1 (`6D44` class, `6C82` owner, `6CD6` sea, `63CE` land, `6464` type bit).
