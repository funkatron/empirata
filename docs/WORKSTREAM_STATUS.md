# Empirata parallel workstream ledger

Updated 2026-11-08. This ledger tracks independent areas of work and their CI gates. **These are workstreams, not claims that separate autonomous subagents have been launched.**

| Stream | Scope | Status | Dependency / gate | Evidence |
|---|---|---|---|---|
| A — CI and reliability | Green verify, reproducible installs, replay/screenshot tooling | **Stable; current runs to recheck** | Baseline for engine and eval PRs | `main` verify green; #58 `package-lock.json` + Node 24.22.2; #53 replay Action; #57 map-screenshots workflow |
| B — Reconnaissance AI | Frontier scouting, stale sightings, held-out policy comparison | **Active; opt-in evaluation available** | Manual smoke artifact then incomplete-shard diagnosis; no full rerun yet | #51 scout targeting; #50 stale sightings/idle transports; #52 evaluation runner; #60 incomplete-status reporting and manual smoke/full modes |
| C — Manual/DOS conformance | Unit/rules audit, detection/combat, 2.05C comparisons | **In progress** | Independent of AI tuning | `docs/MANUAL_CONFORMANCE_AUDIT.md`, `tests/manual-unit-roster.test.mjs` |
| D — Campaign outcomes | Baseline study + follow-on telemetry on holdout maps | **Baseline complete; tuning pending** | Do not mutate raw 42-campaign archive | #45 baseline + `STRATEGY_AND_TACTICS_PLAN.md`; `tests/ai-campaign.test.mjs`, `ai-vs-ai` |
| E — UI / graphics | Fit world, Game menu, screenshot baselines, G1–U1 plan | **Partial; camera WIP not on GitHub** | Draft #56 spec; G1 harness on main; resume local UI stash before implementation | #47–49 map/campaign UI; #57 WebKit captures; `docs/ROADMAP.md` Priority 1 checks open |
| F — Gameplay defects | Lost ports, post-capture production, ownership memory | **Open** | Regression tests before strategy work | `docs/ROADMAP.md` 2026-10-27 issues |
| G — Independent review | Adversarial testing and wargaming second pass | **Pending** | Manual audit + campaign evidence | `docs/ROADMAP.md` Priority 3A |

## Coordination rules

1. Never have concurrent changes overwrite the same source file without refreshing its current SHA and reconciling the diff.
2. Treat each commit as a bounded change with a matching test; report the exact CI conclusion, not deployment success alone.
3. Distinguish test failure, historical-rule uncertainty, and strategy-performance failure.
4. Independent documentation and test-design work can proceed while implementation CI runs. Code changes that depend on a failing implementation should wait for the CI gate.
5. Update this ledger when a stream changes status, with commit and test evidence. Do not invent subagent identities or report parallel execution that did not occur.

## Next verification gates (2026-11-08)

- [ ] Verify an explicitly dispatched **smoke** evaluation run and inspect `completion.json`, metadata and its single campaign artifact. PR-triggered validation success is not a smoke run.
- [ ] Profile continents and design revision-verified resumable checkpoints before authorizing another full 72-campaign evaluation. Preserve partial artifacts; do not treat `time-limit` as a draw.
- [ ] Recover local `cursor/ui-zoom-screenshots-tests-4a9d` stash on its original machine, rebase onto current `main`, and review before pushing. The stash is **not accessible from GitHub**.
- [ ] Complete G1 viewport/DPR evidence and DOS reference comparison before changing rendering sharpness; keep #56 draft pending owner authorization.

