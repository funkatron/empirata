# Empirata

- Preserve Interstel 2.05 gameplay rules. Read the relevant rules and manual notes under `docs/` before changing engine behavior.
- Edit application source under `src/` and `public/`. Keep generated build changes out of source patches.
- Run `npm run build` with Node 24. Run `npm test` for engine changes and check relevant interactions in a browser for UI changes.
- Check GitHub CI and Copilot reviews before merging. Keep extended agent documentation under `agents/`.
- For ChatGPT/agent classic DOS parity work, use [`agents/classic-parity-chatgpt-pack.md`](agents/classic-parity-chatgpt-pack.md) with [`docs/DOS_ALGORITHM_RULESET.md`](docs/DOS_ALGORITHM_RULESET.md); one ALG per PR; prioritize classic DOS AI as the intended default. Preserve modern AI as a selectable experimental difficulty, but freeze its strategic development. Keep shared engine rules and performance optimizations for both policies. Do not switch gameplay to an incomplete classic AI without a clearly marked staged implementation.
- For post-review continuation (architecture, doc drift, recommended sequence, semver iteration), use [`agents/extended-review-chatgpt-handoff.md`](agents/extended-review-chatgpt-handoff.md). Iterate semantic version when coherent milestones ship; do not leave the product stuck on an outdated 0.x label.
- Do not push commits straight to `main`. Use a feature branch and open a PR (`gh pr create`); merge only when asked.
