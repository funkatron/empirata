# Empirata parallel workstream ledger

Updated 2026-10-26. This ledger tracks independent areas of work and their CI gates. **These are workstreams, not claims that separate autonomous subagents have been launched.** No subagent-spawning capability is available in this session.

| Stream | Scope | Status | Dependency / gate | Evidence |
|---|---|---|---|---|
| A — CI and reliability | Restore green build after naval-scout regression; guard save/replay, fog and boundaries | **In progress** | Must pass before expanding strategic AI | `48700b7` corrects test expectation; CI pending |
| B — Reconnaissance AI | Destroyer frontier scoring; later production, map coverage and scout benchmarking | **Planner implemented; integration next** | Stream A CI green | `20b3298`, `4547529` |
| C — Manual/DOS conformance | Eight-unit audit, detection/attack matrix, controlled 2.05C comparisons | **Initial audit complete; deeper audit pending** | Independent of B's gameplay logic | `docs/MANUAL_CONFORMANCE_AUDIT.md`, `tests/manual-unit-roster.test.mjs` |
| D — Campaign outcomes | 100–200 round AI-vs-AI telemetry: cities discovered/captured, landings, attrition, stalls | **Pending** | Stable B planner, repeatable tests | `tests/ai-vs-ai.test.mjs`, `tests/ai-campaign.test.mjs` |
| E — Independent review | Adversarial testing and wargaming second pass | **Pending** | Manual audit and campaign evidence | `docs/ROADMAP.md` |

## Coordination rules

1. Never have concurrent changes overwrite the same source file without refreshing its current SHA and reconciling the diff.
2. Treat each commit as a bounded change with a matching test; report the exact CI conclusion, not deployment success alone.
3. Distinguish test failure, historical-rule uncertainty, and strategy-performance failure.
4. Independent documentation and test-design work can proceed while implementation CI runs. Code changes that depend on a failing implementation should wait for the CI gate.
5. Update this ledger when a stream changes status, with commit and test evidence. Do not invent subagent identities or report parallel execution that did not occur.
