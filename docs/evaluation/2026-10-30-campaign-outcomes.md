# Campaign outcomes after fleet expansion

## Scope

Engine commit: `731f0433b09d624ef98271d45e080ddd9c701ea9` (PR #17).
Twelve clean campaigns: three generated layouts, seeds 17 and 83, each
with original and swapped starting factions, 100 rounds each. No prepared units,
routes, scouting knowledge or production progress. Every final save passed the
normal export/import validator. This is a baseline, not a before/after comparison.

## Results

Each cell lists Blue / Red. Landings count army landing events, not invasions.

| Layout | Seed | Swapped | Cities | Captures | Landings | New known cells |
| --- | --- | --- | --- | --- | --- | --- |
| continents | 17 | No | 1 / 1 | 0 / 0 | 0 / 0 | 704 / 360 |
| continents | 83 | No | 2 / 1 | 1 / 0 | 2 / 3 | 1102 / 935 |
| islands | 17 | No | 1 / 2 | 0 / 1 | 0 / 4 | 215 / 825 |
| islands | 83 | No | 1 / 1 | 0 / 0 | 2 / 0 | 1081 / 1022 |
| archipelago | 17 | No | 1 / 2 | 0 / 1 | 3 / 2 | 785 / 1030 |
| archipelago | 83 | No | 2 / 1 | 1 / 0 | 3 / 2 | 1022 / 1096 |
| continents | 17 | Yes | 1 / 1 | 0 / 0 | 0 / 0 | 360 / 704 |
| continents | 83 | Yes | 1 / 2 | 0 / 1 | 3 / 2 | 935 / 1102 |
| islands | 17 | Yes | 2 / 1 | 1 / 0 | 4 / 0 | 825 / 215 |
| islands | 83 | Yes | 1 / 1 | 0 / 0 | 0 / 2 | 1022 / 1081 |
| archipelago | 17 | Yes | 2 / 1 | 1 / 0 | 2 / 3 | 1030 / 785 |
| archipelago | 83 | Yes | 1 / 2 | 0 / 1 | 2 / 3 | 1100 / 1017 |

## Findings and next work

- Eight of twelve campaigns gained one city in total; four gained none.
  None demonstrates a sustained conquest campaign within this horizon.
- Both continents/17 campaigns explored without landing or capturing. Investigate
  known objectives, port access, and ground routing together before changing fleet
  demand. Discovery alone is insufficient evidence of useful exploration.
- Islands/83 landed two armies without captures in both starting assignments.
  Follow the landed units and objective reachability to distinguish scouting drops
  from failed assault logistics.
- Swapped captures and landing totals mirror the original runs. Exploration on
  archipelago/83 differs slightly; faction turn order is not perfectly symmetric.
- No loaded transport loss was observed. This small sample does not establish
  transport safety under hostile coastal defense.

Next strategy investigation: trace discovery-to-capture delays on ordinary
campaigns, then evaluate changes against this matrix. Keep distant rendezvous and
fighter strategy on the roadmap; this evidence does not justify selecting either
as the cause of slow expansion.

## Measurement limits

Capture and loss metrics compare round boundaries. A city captured and recaptured
inside one round is invisible to these net counters. Units produced and destroyed
within the same round are also invisible. Loaded-hull loss requires removed cargo
that was aboard at the preceding boundary, so newly boarded cargo can be missed.
The tests distinguish surviving disembarked troops from destroyed cargo.

Timing measures wall-clock duration of `advanceLabRound` only; it excludes
measurement snapshots and save validation. Concurrent evaluation/test processes
shared this machine, so these values are diagnostic, not performance benchmarks.
Existing production/boarding/landing counters parse event messages and require
maintenance if those messages change. No strategy decisions consume measurements.

## Reproduce

```sh
npm run build
ROUNDS=100 SEEDS=17,83 node scripts/evaluate-ai.mjs > original.json
ROUNDS=100 SEEDS=17,83 SWAP=1 node scripts/evaluate-ai.mjs > swapped.json
```

Raw observations: [campaign-outcomes.json](2026-10-30-campaign-outcomes.json).

## Verification

- [x] 212 tests pass with coverage gates.
- [x] Four standalone bundle checks pass.
- [x] Twelve generated campaigns complete and pass save validation.
- [x] Boundary-loss tests cover destroyed cargo and surviving landed troops.
