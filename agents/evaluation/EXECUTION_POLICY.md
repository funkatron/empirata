# Held-out evaluation execution policy

Routine PR CI runs only validation, build, manifest audit, and focused tests. It **does not run the 72 long campaigns**.

The `Held-out reconnaissance evaluation` GitHub Action is manually dispatched with `mode`:

- `smoke` (default): one candidate comparison on `continents`, seed `104729`, limited to 30 rounds. This checks wiring, pinned revisions, and result generation. It is **not** evidence of policy quality or a substitute for matched controls.
- `full`: six shards, 12 campaigns each, targeting 300 rounds per campaign. Each campaign retains a 180-second guard. A `time-limit` produces an incomplete result and a failing shard, not a draw or a successful comparison. Artifacts are uploaded even on failure.

The full evaluation is currently **not resumable**. Do not rerun failed shards automatically: inspect artifacts first, profile the continents bottleneck, and implement checkpoint/restart with revision/hash verification before spending another full run. A resume must preserve the initial state, RNG, policy pairing, faction, seed, and round index. It must not count partial 30-round smoke runs as full observations.

## Follow-up engineering tasks

- [x] Remove long campaigns from automatic PR CI.
- [x] Add a bounded manual smoke mode.
- [ ] Add per-round timing and identify the continents hotspot using a representative fixed seed.
- [ ] Add resumable checkpoints and artifact reuse, rejecting mismatched revisions or manifests.
- [ ] Decide full-run time budgets from measured throughput, not arbitrary timeout increases.
- [ ] Verify a manually dispatched smoke artifact before authorizing another full evaluation.

No long-running evaluation should be automatically triggered by documentation or ordinary code changes.
