# Empirata parallel workstream ledger

Updated 2026-11-07. This ledger tracks independent areas of work and their CI gates. **These are workstreams, not claims that separate autonomous subagents have been launched.**

| Stream | Scope | Status | Dependency / gate | Evidence |
|---|---|---|---|---|
| A — CI and reliability | Green verify, reproducible installs, replay/screenshot tooling | **Stable** | Baseline for engine and eval PRs | `main` verify green; #58 `package-lock.json` + Node 24.22.2; #53 replay Action; #57 map-screenshots workflow |
| B — Reconnaissance AI | Frontier scouting, stale sightings, held-out policy comparison | **Active** | Held-out manifest audit before merge | #51 scout targeting; #50 stale sightings/idle transports; draft #52 runner + GA (rebased 2026-11-07) |
| C — Manual/DOS conformance | Unit/rules audit, detection/combat, 2.05C comparisons | **In progress** | Independent of AI tuning | `docs/MANUAL_CONFORMANCE_AUDIT.md`, `tests/manual-unit-roster.test.mjs` |
| D — Campaign outcomes | Baseline study + follow-on telemetry on holdout maps | **Baseline complete; tuning pending** | Do not mutate raw 42-campaign archive | #45 baseline + `STRATEGY_AND_TACTICS_PLAN.md`; `tests/ai-campaign.test.mjs`, `ai-vs-ai` |
| E — UI / graphics | Fit world, Game menu, screenshot baselines, G1–U1 plan | **Partial** | Draft #56 spec; G1 harness on main | #47–49 map/campaign UI; #57 WebKit captures; `docs/ROADMAP.md` Priority 1 acceptance open |
| F — Gameplay defects | Lost ports, post-capture production, ownership memory | **Open** | Regression tests before strategy work | `docs/ROADMAP.md` 2026-10-27 issues |
| G — Independent review | Adversarial testing and wargaming second pass | **Pending** | Manual audit + campaign evidence | `docs/ROADMAP.md` Priority 3A |

## Coordination rules

1. Never have concurrent changes overwrite the same source file without refreshing its current SHA and reconciling the diff.
2. Treat each commit as a bounded change with a matching test; report the exact CI conclusion, not deployment success alone.
3. Distinguish test failure, historical-rule uncertainty, and strategy-performance failure.
4. Independent documentation and test-design work can proceed while implementation CI runs. Code changes that depend on a failing implementation should wait for the CI gate.
5. Update this ledger when a stream changes status, with commit and test evidence. Do not invent subagent identities or report parallel execution that did not occur.
