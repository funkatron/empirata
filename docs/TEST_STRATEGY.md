# Empirata test strategy and coverage gates

Updated 2026-10-23. The target is Interstel DOS v2.05C. Historical DOS binary assets must not be committed.

## Required checks

- `npm test`: compile TypeScript, execute Node tests, report **engine-only** V8 coverage and fail below 85% line / 80% branch. The GitHub Pages workflow calls `npm test` before publishing.
- `npm run test:coverage`: same test and coverage operation; direct invocation is useful for local development.
- No claim of exact historical fidelity follows from coverage alone: manual-confirmed rules and binary-confirmed behaviors require separate oracle fixtures.

## Current coverage (local, Node 22)

- 74 passing tests (count as of this revision, including 128-seed combat and 128-seed conquest stress checks).
- Engine line coverage approximately 92.45%; branch coverage approximately 88.28%; function coverage approximately 91.11%.
- Reports target `dist/engine/*.js`, deliberately excluding test files and the browser interface.
- The coverage floors are initial regression gates, not final quality targets.

## Important regression scenarios

1. **RNG:** original seed-1 and zero-seed 15-bit output vectors, determinism, saved state.
2. **Combat:** exact seed-1 result, damage, movement, one-winner invariant, random draw accounting and 128-seed replay.
3. **Conquest:** seeded 50% capture threshold across 128 seeds, army consumption and city ownership.
4. **Movement/orders:** per-turn allowance, cardinal/diagonal movement, order persistence, patrol direction changes and safe contact interruption.
5. **Fog of war:** opponent secrecy, stale reports and a hidden-city route-planning regression.
6. **Save files:** roundtrip, invalid unit/city types, illegal coordinates, duplicate IDs, broken cargo links, malformed standing orders and corrupt RNG values.

## Remaining high-priority coverage gaps

- **UI:** automate touch/pointer selection, panel controls, pan/zoom, save/restore and a played round in a real browser. No UI coverage gate yet.
- **Original-game oracle:** acquire legal/reference DOS play traces for draw timing, unusual detection rules, naval mechanics and production rounding.
- **Logistics:** loading/unloading and carrier operations are not implemented yet; add rigorous tests before implementing them.
- **Adversarial persistence:** extend validation to nested fog-of-war knowledge records, event records, cargo cycles and total import-size limits.
- **AI:** deterministic strategic fixtures and no-omniscience differential tests as tactics develop.
- **Mutation testing:** validate that core combat and pathfinding tests fail under deliberately introduced faults.

## Policy

Build new rules using a *failing red test → smallest rule change → green test* sequence. Prefer fixed, explainable expected states over permissive assertions. For uncertain mechanics, mark test expectations as provisional rather than presenting assumptions as original behavior.