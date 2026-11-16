# Q3 OODA plan — ALG-AI-001 slice (2026-11-16)

Roadmap follow-on item **3**: first classic move/order tick, one ALG per PR.

## Observe

- `docs/DOS_ALGORITHM_RULESET.md` ALG-AI-001: computer order **0 (None)** returns direction **1**; **1 (Sentry)** holds with wake checks (deferred).
- Q2 classic executor is a no-op boundary.

## Orient

- Implement **order-none bearing only** via existing `setOrder` + `moveUnit` (one step, computer pass limit 1 per unit).
- Sentry remains hold (no wake parity in this PR).
- Classic policy still does not run modern production/heuristics.

## Decide

PR `cursor/q3-alg-ai-001-85b7` (stacks on Q2):

- `src/engine/ai/classic-order-tick.ts` — recovered direction index for order none.
- Extend `classic-executor.ts` with injected move/setOrder.
- `tests/alg-ai-001-order-none.test.mjs` + adjust routing test.

## Act

`npm test`, push, stacked PR on #128.

**Exit:** Documented ALG-AI-001 order-0 gate covered by tests; classic turns may move `none` units one legal step on the recovered bearing.