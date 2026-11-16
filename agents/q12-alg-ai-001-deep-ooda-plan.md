# Q12 OODA plan — deeper ALG-AI-001 pathing (2026-11-16)

## Observe
- Q7–Q8 shipped random/sentry/go-home/move-to with human `routeStep` and blunt bearing steps.
- DOS doc: passability masks, `min(125,2d+25)` path budget, `0x4C52` direction legalization, fighter Move-To fuel gate, patrol goal steps.

## Orient
- Keep one activation per unit per computer pass; reuse existing `moveUnit` validation.
- Computer uses omniscient terrain for pathing (active faction knowledge after `updateAllKnowledge`).

## Decide
- `classic-passability.ts` + `classic-path.ts` for budgeted BFS and legal bearings.
- Executor wires grade-aware `classicRouteStep`, patrol, randomized bearings, fighter low-fuel → go-home.

## Act
- PR `cursor/q12-alg-ai-001-deep-85b7` stacked on Q11 or `main` after merge.