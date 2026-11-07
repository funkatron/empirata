# Seeded reconnaissance fixture: implementation contract

Status: design committed; executable fixture not yet implemented. Scope: PR #51, no release or merge.

## Why

The existing `scripts/compare-reconnaissance.mjs` uses `makeCampaign()`, which intentionally supplies **no units or scouting memory**. Thus 60- or 180-round campaigns may never reach the stale-contact decision that PR #51 changes. A targeted fixture must exercise that decision at round zero, without changing the 1987 rules.

## Fixture construction

1. Generate terrain and cities with `makeCampaign(engine, layout, seed, {swap})`, then create a deterministic evaluation-only state. Place eligible destroyers at reachable sea approaches and mobile armies at reachable land frontiers, with no garrison/escort assignment. Place loaded transports in friendly ports as passive logistics controls.
2. Construct faction-private knowledge from a **plausible observed snapshot**: previously seen enemy units on known cells, now absent, with their sightings aged by the normal knowledge representation. Keep two reachable unexplored frontiers: one near a stale contact, one competing frontier at comparable route cost. Also include an unreachable/exhausted contact as a negative control.
3. Preserve hidden enemy units/cities exclusively in full game state; assert the active faction's `getPlayerView()` is unchanged when hidden positions change. Never use full-state coordinates in AI targeting.
4. Validate every placed unit against terrain, stacking, movement and fuel rules. Do not alter movement/combat or supply extra AI knowledge. Use engine state APIs where possible, rather than guessing serialized fields.

## Reproducibility and controls

- Fix layout, seed, faction assignment, RNG, unit roster, positions, knowledge and turn counter.
- Create the fixture once using baseline engine and structured-clone it for candidate; reject fixture if either engine cannot load it.
- Run both factions, plus faction-swapped equivalents. Include at least two layouts and a second held-out seed; do not tune on held-out fixtures.
- Run checkpoints at 20, 50 and 100 rounds. Keep the existing 180-round natural campaigns as a separate external-validity check.
- Capture the initial private view and a stable fixture digest in each report.

## Required evidence

- First decision: eligible scout ID, chosen destination/first step, reachable route length, frontier coverage and stale-contact proximity. Compare baseline vs candidate before advancing the game.
- Number of decisions changed by PR #51; unique frontier visits; stale contacts investigated; newly revealed land; first newly known hostile/neutral city; scout losses; cargo idle in ports; city captures.
- Distinguish **decision change**, **information gain**, and **strategic gain**. State divergence alone is insufficient.
- Add regression tests for identical save/reload decisions, hidden-world independence, faction swapping, unreachable contacts, and preserving escorts/garrisons.

## Stop conditions

If candidate and baseline choose identical scout steps on the deliberately discriminating fixture, investigate the planner call path and scoring before running more campaigns. If decisions differ but discovery does not improve, inspect route feasibility and information gain. Do not merge PR #51 based only on passing CI.
