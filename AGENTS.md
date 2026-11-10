# Empirata

- Preserve Interstel 2.05 gameplay rules. Read the relevant rules and manual notes under `docs/` before changing engine behavior.
- Edit application source under `src/` and `public/`. Keep generated build changes out of source patches.
- Run `npm run build` with Node 24. Run `npm test` for engine changes and check relevant interactions in a browser for UI changes.
- Check GitHub CI and Copilot reviews before merging. Keep extended agent documentation under `agents/`.
- For ChatGPT/agent classic DOS parity work, use [`agents/classic-parity-chatgpt-pack.md`](agents/classic-parity-chatgpt-pack.md) with [`docs/DOS_ALGORITHM_RULESET.md`](docs/DOS_ALGORITHM_RULESET.md); one ALG per PR; do not replace modern AI by default.
- Do not push commits straight to `main`. Use a feature branch and open a PR (`gh pr create`); merge only when asked.
