# Q18 OODA — slice E: default Classic DOS (2026-11-16)

## Observe

- `DEFAULT_AI_POLICY` is modern; campaigns inherit it in `makeCampaignMap`; menu HTML selects Modern first.
- `resolveAiPolicy` treats omitted `aiPolicy` as modern — used by rules-lab fixtures and pre-0.5.3 saves.
- Classic ALG-AI-001/002/004 staged; slices A–D done.

## Orient

- **Product default:** new campaigns = Classic DOS grade 1 (`DEFAULT_AI_POLICY`).
- **Legacy:** saves/fixtures with **no** `aiPolicy` keep modern executor (repro for `tests/ai-*.test.mjs` and old JSON).
- **Labs:** `makeRulesLab` unchanged structurally; implicit modern via `resolveAiPolicy` when policy omitted.
- **Semver:** **0.6.0** minor (migration slice E policy).

## Decide

PR `cursor/slice-e-default-classic-85b7`: policy.ts, UI menu default, docs, tests.

## Act

`npm test` → push → PR.

**Status:** implemented on `cursor/slice-e-default-classic-85b7` (494 tests).