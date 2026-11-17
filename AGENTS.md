# Empirata

- Preserve Interstel 2.05 gameplay rules. Read the relevant rules and manual notes under `docs/` before changing engine behavior.
- Edit application source under `src/` and `public/`. Keep generated build changes out of source patches.
- Run `npm run build` with Node 24. Run `npm test` for engine changes and check relevant interactions in a browser for UI changes.
- Check GitHub CI and Copilot reviews before merging. Keep extended agent documentation under `agents/`.
- For ChatGPT/agent classic DOS parity work, use [`agents/classic-parity-chatgpt-pack.md`](agents/classic-parity-chatgpt-pack.md) with [`docs/DOS_ALGORITHM_RULESET.md`](docs/DOS_ALGORITHM_RULESET.md); one ALG per PR; prioritize classic DOS AI as the intended default. Preserve modern AI as a selectable experimental difficulty, but freeze its strategic development. Keep shared engine rules and performance optimizations for both policies. Do not switch gameplay to an incomplete classic AI without a clearly marked staged implementation.
- For post-review continuation (architecture, doc drift, recommended sequence, semver iteration), use [`agents/extended-review-chatgpt-handoff.md`](agents/extended-review-chatgpt-handoff.md). Iterate semantic version when coherent milestones ship; do not leave the product stuck on an outdated 0.x label.
- **Semver (0.x):** Bump the **patch** (e.g. 0.5.1 → 0.5.2) when shipped user-visible behavior or UI changes land—even small ones. Reserve **minor** bumps for broader feature themes. Keep `package.json`, `public/index.html` banner/title, and README “Version” section in sync.
- Do not push commits straight to `main`. Use a feature branch and open a PR (`gh pr create`); merge only when asked.

## UI layout stability (product priority)

Empirata is a **tool**, not a marketing page. Users build muscle memory for control locations.

- **Toggling visibility must not reflow sibling UI.** Showing or hiding panels, rows, or controls must not move other controls vertically or horizontally.
- Prefer keeping layout slots reserved: `visibility: hidden` + `pointer-events: none` (and `inert` where appropriate), fixed-height regions, or opacity — not `display: none` / `[hidden]{display:none}` on blocks in the **persistent shell** (sidebar, topbar, map toolbar) unless the slot is explicitly reserved elsewhere.
- Exceptions: truly non-visual inputs (file pickers), ephemeral overlays (dialogs, toasts), and content that is intentionally collapsible **only** when the user expects layout change (document in PR).
- UI PRs that show/hide chrome require a **before/after screenshot** or short recording demonstrating stable positions of unchanged controls.

## Planning (OODA)

Before **non-simple** work (roadmap items, multi-file engine/UI changes, new tests/fixtures, DOS parity), sketch an **OODA** loop and record it under `agents/` when the task spans more than one PR or touches gameplay rules:

1. **Observe** — Facts only: current code paths, tests, roadmap/docs, CI status; cite files.
2. **Orient** — Constraints: Interstel 2.05 fidelity, fog/legal boundaries, frozen modern AI strategy, PR boundaries, explicit out-of-scope.
3. **Decide** — Scope, PR split, success criteria, risks.
4. **Act** — Ordered next steps (branches, tests to add, docs to update).

Simple tasks (typo, single-line fix, question-only) skip a written plan. Example: [`agents/p2-ooda-plan.md`](agents/p2-ooda-plan.md).
