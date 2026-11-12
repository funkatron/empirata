# Performance-aware AI development baseline (2026-11-12)

## Source of truth
- Main baseline: `998f3ba1d9900f8d5b13d99ff06b69c6e319cf08` (merged PR #92). Recheck main before implementing; do not assume this SHA remains current.
- PR #92: https://github.com/funkatron/empirata/pull/92
- Original measurements and environment: `.cursor/rules/perf-ui-snappiness-log.mdc`; diagnostic harness: `scripts/bench-rounds.mjs`. Timing results are host-specific, not a CI performance guarantee.
- Historical behavior: `docs/DOS_ALGORITHM_RULESET.md`; engineering constraints: `AGENTS.md` and `agents/`.

## Preserved architectural contracts
1. `playAiOpponent` owns one private mutable game clone for an AI turn. Public actions remain immutable by default; mutable operations must not leak to caller-owned game state.
2. Reuse a faction-limited `PlayerView` and its unit/hostile-city indexes within the turn. Planning must not consult omniscient state or repeatedly rebuild indexes.
3. Planners return deterministic intentions; the authoritative engine applies legal actions. Preserve action order, RNG consumption, save/replay outcomes, and faction symmetry.
4. UI pan/zoom uses animation-frame-coalesced paint and cached terrain/fog. Preserve cache invalidation and do not trigger expensive inspector/event rebuilds without state changes.
5. CvC playback yields between `labRoundPhases`; Pause finishes an in-flight round at a valid blue-turn boundary. Autosaves use compact, latest-wins IndexedDB writes. Preserve ordinary export format.

## Completed evidence and limits
- PR #88: seeded faction-swapped captured-city production and save/reload tests.
- PR #89: optional WebKit checks for both CvC factions (0/6 → 3/6 → 0/5) and human production selector; 16 screenshots. The original reported production-stall symptom was not reproduced. No claim of historical DOS scheduling parity.
- PR #90: embarked move errors direct callers to `disembarkArmy` / `launchFighter`; no movement-rule change.
- PR #91: user-selected CvC inspector scrolls into view; desktop and iPad portrait/landscape screenshot evidence.
- PR #92: p95 AI lab 505→231 ms, skirmish 1292→616 ms, continents 365→153 ms on its recorded host; `npm test` reported 408 passing. No universal speed claim.

## Next bounded PR sequence
1. Behavior-lock tests: fixed seeded state/RNG snapshots, public immutability, faction-limited intelligence, phased-versus-monolithic equality; baseline diagnostic benchmarks. Avoid machine-specific timing assertions in CI.
2. Extract one cohesive `planAi*` helper into `src/engine/ai/` with existing shared view/index context. Keep clone ownership and authoritative execution unchanged; compare state and performance with baseline.
3. Continue small planner extractions only after previous CI, Copilot review, and benchmark interpretation. Optional executor extraction belongs in a separate PR.

## PR hygiene and documentation completion
- Prefer one active implementation PR at a time for overlapping engine areas; avoid stacked speculative PRs.
- At task start, inventory open PRs and identify dependencies, overlap, and superseded work. Do not close or merge someone else's work without explicit authorization.
- At task finish, update the relevant roadmap, technical documentation, and evidence links in the same PR. Include a concise completion checklist, measured results, limits, and follow-up.
- Before merging, review current main, CI, Copilot reviews and conflicts; squash only when authorized. Verify Pages deployment separately.
- After merging, verify the branch has no unique unmerged commits before deleting it; preserve investigation artifacts and links. Record open follow-ups in the roadmap rather than leaving placeholder PRs.
- SemVer advances at approved milestones, not individual commits.
