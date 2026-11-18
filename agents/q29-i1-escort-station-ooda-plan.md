# Q29 I1 — escort stationing `1D09:03C2` (2026-11-18)

## Observe

- H4 shipped `0x4600` order-switch goals; station ring still uses Chebyshev-only sort.
- Ruleset: escort may call **`1D09:03C2`** for a stationing tile beside the target.

## Decide

- **`classicEscortStationCandidates`** — chart-passable neighbors of target, ranked:
  1. distance from escort
  2. “behind” target bearing (inverse of `go-direction` or move-to axis)
  3. sea openness (sea-neighbor count for hulls)
  4. avoid city tiles when tied
- Wire into **`classicEscortCloseRangeGoal`** fallback and **`classicEscortStep`**.

Evidence: **[T]** until Raiden traces `1D09:03C2`.

## Act

Branch `cursor/i1-escort-1d09-85b7`; v0.6.13; tests `alg-ai-001-escort-station.test.mjs`.