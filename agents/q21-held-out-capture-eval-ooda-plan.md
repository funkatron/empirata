# Q21 OODA — Held-out capture evaluation harness

## Observe
- `agents/evaluation/held-out-reconnaissance.md` wants retained captures at fixed horizon; not optimized on 42-campaign baseline.

## Decide
- `scripts/held-out-capture-eval.mjs`: seeds from manifest, classic policy, report neutral/enemy captures at round N.
- CI: optional workflow_dispatch; default verify unchanged.
- Document in `docs/TEST_STRATEGY.md`.

## Act
- Branch `cursor/q21-held-out-capture-eval-85b7` → **0.6.6** or docs-only if script-only.