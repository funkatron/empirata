# Held-out reconnaissance comparison

## Purpose

Compare the PR 51 reconnaissance candidate with its frozen parent without changing gameplay rules. The adjacent JSON is a proposed protocol, not an executable runner or completed experiment. No strength claim is supported yet.

## Current gap

`scripts/campaign-study.mjs` uses seeds 17, 83 and 211 and a single imported engine for both factions. Those runs are useful diagnostics, but cannot provide this mixed-policy comparison. Its worker currently uses the map seed and subsequent game RNG together. Existing checkpoint totals do not identify retained enemy-city captures reliably.

## Design

Use six proposed maps: three layouts times two map seeds. For each map, run two combat seeds, two candidate locations, and two candidate faction assignments: 48 candidate-versus-parent campaigns. For controls use both baseline policies, two combat seeds, and two blue starting locations: 24 campaigns. Generate maps once with the baseline generator, freeze initial states, and exchange owners independently from geometry. Audit historical manifests before declaring the proposed maps unseen; replace overlaps before results are inspected.

Blue-first order is fixed, so faction and turn order cannot be estimated separately in this design. Report their combined effect explicitly. Preserve faction-specific visibility and the original rules.

## Outcome definitions

Primary: number of initially enemy-owned cities captured by the evaluated faction and still held at the completed 300-round horizon. Record ownership transitions so recaptures and neutral-city expansion remain distinguishable. Report early terminal games separately with final ownership and outcome.

Safety: loaded-transport losses, counting a transport removal only when its pre-removal cargo is nonempty. Record embarked army losses too. Diagnostic: first enemy-city discovery from faction-visible knowledge, and loaded cargo idle turns with an explicit movement-based definition. Missing instrumentation must be reported as unavailable, never zero.

Report paired differences within map, combat seed, starting location and faction assignment. Group by layout and location; retain raw campaign records. Six maps provide screening evidence only. Discovery speed alone does not establish strategic improvement.

## Completion checks

- [x] Pin baseline and candidate revisions
- [x] Specify independent map/combat seeds and balanced placements
- [x] Identify limitations in existing runner
- [ ] Audit proposed maps against historical manifests
- [ ] Implement per-faction policy selection with shared rules engine
- [ ] Freeze initial states and emit complete reproducibility metadata
- [ ] Add manifest validation and grouped reporting
- [ ] Verify paired-state identity and deterministic replay
- [ ] Run comparisons on GitHub Actions and retain raw artifacts
- [ ] Review CI and any Copilot feedback before merge

No application version change, merge, or deployment is included.
