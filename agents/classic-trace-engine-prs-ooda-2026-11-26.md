# OODA: engine PRs from the 2026-11-24…26 DOS traces

## Observe

| Trace | Engine today | DOS (grade 1 = all `62E8` flags 0) |
|---|---|---|
| Resign tally (`0xDF58`) | — | **Done: #211 (v0.7.2)** |
| Army reissue `0x1F238` [D] | `classicArmyPortEmbarkStep`, then `classicArmyConquestStep`: BFS each move to **any** known hostile city, no radius (`classic-executor.ts:150-151`, `classic-move.ts:97`) | Army on land: on alternate turns (`(6D8E[p] ^ u) & 1`) call city task `0x1F454`; then 20-slot list `0x1F5F4` (order 5, ≤ 12); then board transport `0x1F6AA` (order 0xE type 3, ≤ 10 → Sentry); then grade-2 fallback `91B2` (order 0xF); else wander order 0x10 with `03BF:0C46` heading. Army on a transport glyph: order 0x11; `12C2:0845`; `0x1F454`; explore probe `03BF:0C6E` |
| City task `0x1F454` [D] | — | `rand() % cityCount` start; first **known** city (`0x51A ≠ 0`) reachable by pathfinder table `2AD8` (land, unexplored, **neutral city**; player cities blocked) within Chebyshev **12** (grade 1) / 20 + cap `(120 − combat_eff)/10` (grade 2). Writes order **0xF** + city loc |
| Contact step `12C2:115F` / `0x4A2A` [D] | Adjacent hostile city taken by `classicArmyConquestStep` | Army steps into any adjacent non-own city. Attack / turn-away masks per type; grade 1 `0x4B52` returns 1 early |
| Computer escort `0xC` [D] | `escort` order exists for player use only | Grade 1: `0x1D1A6` calls `0x1DD44` (attach a type 2/4/5/7 ship to a random reachable own transport); order 0xC status 1 every activation |
| Ship hunt `0x1DE2A` [D] | none | Nearest sea-reachable remembered sighting (5 per enemy type) in the hunt mask → order 5 |
| Ship repair (byte 8, `1D09:07B2`) [D] | `classicDamagedShipSeeksPort` + `go-home` | Order 8 to nearest friendly city; done when HP full |

## Orient

- Interstel fidelity is the goal, but `AGENTS.md` forbids switching gameplay to an incomplete classic AI without a clearly staged implementation.
- **Strength risk:** under DOS grade 1, armies stop seeking enemy cities beyond adjacency. Today's BFS-to-any-hostile-city makes the classic AI more aggressive than DOS. Matching DOS will likely make it weaker in long campaigns. That is correct for parity, but must be measured and called out.
- Every PR below changes RNG draws and saves → **update `GOLDEN` in the same PR with the reason** (rule in `tests/golden-parity.mjs`).
- Modern AI is frozen; none of this touches it.
- One ALG per PR; patch bump each.

## Decide

| PR | Scope | Risk | Golden |
|---|---|---|---|
| E1 | ✅ Resign tally (#211) | Low | Unchanged |
| E2 | **Army reissue chain** `0x1F238` + city task `0x1F454` (grade-gated radius/cap; random start; known-city check; pathfinder table `2AD8` over the player's chart). Persist the task as `move-to` (DOS order 0xF) and the wander as order 0x10. Keep adjacent-city capture as the contact step | **High** (strength) | Changes |
| E3 | Contact step / masks `0x4A2A` + `12C2:115F` for ships (grade 1 path through `0x4B52`) | Medium | Changes |
| E4 | Computer escort `0x1DD44` / order 0xC (grade-gated) | Medium | Changes |
| E5 | Ship hunt `0x1DE2A` + 5-sighting memory | Medium | Changes |
| E6 | Ship repair as order 8 (rename only if behaviour already matches) | Low | Probably unchanged |

**Success criteria per PR:** focused fixture tests for the DOS branch on grade 1 and grade 2; full suite green; new golden values recorded with the reason; a 3-seed classic CvC campaign comparison (`npm run evaluate:ai` subset or `compare` CI label) attached to the PR, showing city counts and round of first capture, before/after.

**Open before E2:** the `0x1F5F4` 20-slot list (`0xD02 + p*0x28`) has no known writer meaning; E2 can stub it as empty with a `[?]` note, since it only adds order-5 targets.

## Act

1. E2 on branch `engine/classic-army-reissue`: port `0x1F238`/`0x1F454` behind the existing classic policy, tests for parity bit, radius 12/20, cap, neutral-only and known-only.
2. Run the 3-seed comparison and decide with Edward whether the weaker-but-faithful army behaviour ships as default or as a grade option.
3. Then E3 → E4 → E5 → E6, one PR each, rebasing on `main` (parallel UI work in #210).
