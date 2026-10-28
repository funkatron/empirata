# Generated campaign evaluation — 2026-10-28

Six paired 200-round campaigns found **no improvement in final city totals**
from coordinated landing waves. This change has focused tactical regression
coverage; this small campaign sample does not establish stronger strategy.

## Method

- Baseline: deployed commit `460092eb4fb2424d7879731c71d1ac6b561fc351`.
- Candidate engine: `7df99f850ec5abae51f893cde4faeba58031da03` (PR #13).
- Node 24.22.1; 100×60 generated terrain; continents, islands and archipelago;
  seeds 17 and 83; 200 complete rounds each (final game round 201).
- Each side starts with one city, no units, zero production progress, and only
  city sight. Twelve cities are placed before simulation, with spacing and
  distant starting locations. Island layouts require coastal cities; continents
  allow inland starts. Terrain and combat use deterministic but separate seeds.
- No invasion routes are repaired, no enemy objectives are pre-revealed, and
  no combat outcome is selected. Both engines receive identical starting games.
- Production, boarding, landing and mission-pause counters accumulate over the
  run rather than reading only the bounded final event history. Every final
  save passes ordinary import validation. Replay is tested separately on generated
  terrain in normal CI.
- Full measurements: [2026-10-28-campaigns.json](2026-10-28-campaigns.json).

## Results

All city totals below are unchanged between baseline and candidate. Landings
are army disembarkation events, not successful invasions or unique beachheads.

| Layout | Seed | Cities Blue / Red | Baseline landings Blue / Red | Candidate landings Blue / Red |
| --- | ---: | ---: | ---: | ---: |
| Continents | 17 | 4 / 2 | 0 / 0 | 0 / 0 |
| Continents | 83 | 3 / 3 | 0 / 0 | 0 / 0 |
| Islands | 17 | 1 / 6 | 0 / 4 | 0 / 4 |
| Islands | 83 | 6 / 5 | 2 / 2 | 2 / 2 |
| Archipelago | 17 | 2 / 5 | 6 / 9 | 6 / 8 |
| Archipelago | 83 | 6 / 4 | 8 / 13 | 8 / 13 |

Only Red on archipelago/17 changed in the recorded measurements: 9→8 landings,
52→51 produced units, 34→33 remaining armies, 2669→2650 charted cells, and last
city ownership change on round 179→180. These differences do not demonstrate
an advantage. All other recorded faction metrics were identical.

Blue on islands/17 remained at its starting city for the entire 200-round run;
it charted 885 cells and knew only one city. Blue on archipelago/17 had no city
ownership change for its final 94 rounds. These are useful cases for the next
reconnaissance, route and expedition-supply investigation. The measurements
alone do not identify their causes. Do not turn their exact seed outcomes into
strategy acceptance targets.

The user-supplied round-494 diagnostic snapshot has three cities per faction,
one transport each carrying five/six armies, and no destroyers or fighters.
It motivates retaining discovery, boarding, landing and stall measurements.
It is not a paired comparison against this change, and was not repaired,
migrated or used to prescribe the generated terrain.

## Reproduce and extend

```bash
npm run build
node scripts/evaluate-ai.mjs > candidate.json
EMPIRATA_ENGINE=/path/to/built-baseline/dist/engine/index.js \
  node scripts/evaluate-ai.mjs > baseline.json
SWAP=1 SEEDS=101,307 ROUNDS=300 node scripts/evaluate-ai.mjs > follow-up.json
```

`npm run evaluate:ai` also runs the build. Running the script directly after
building gives a JSON-only stdout stream. Progress goes to
stderr. Use the same generator, layouts, seeds and swap setting for both engines.

Next evaluation should add held-out seeds, swap starting factions, and extend
the horizon, recording when discovery and expedition supply stop progressing.
The current sweep covers only six generated maps, normal combat efficiency,
one starting orientation and one strategy playing itself. It does not establish
balance, victory rate, historical AI fidelity or transport durability under
strong naval opposition. Fighter strategy remains a separate roadmap item.

## Reconciliation with PR #14

PR #13 is the consolidated implementation. Both alternatives reserve beaches
with matching and use only faction intelligence. This version retains nearby
mission grouping, readiness waits for the available expedition, and a wave-size
cap for narrow coasts. PR #14 instead required enough armies to outnumber fresh
nearby defenders. That hard minimum is deferred: recruitment and rendezvous are
not implemented, so insufficient forces can wait until the mission timeout
without a way to satisfy the requirement.

PR #14's independent six paired 120-round campaigns also found no improvement
in final city, capture or landing totals. Its generator, raw data and report
remain available on the preserved `feat/coordinated-landings` branch in
[PR #14](https://github.com/funkatron/empirata/pull/14). These observations concern
that alternative policy, not the final consolidated implementation.

Review of both implementations found the same safety regression: a first
landing could reveal a defender, while subsequent orders used the original
view. The consolidated code revalidates each reserved beach against refreshed
intelligence. A regression test reproduces two unsafe unloads before the fix,
then verifies one landing with the remaining cargo held, including save/replay.
The campaign measurements above predate this safety fix; they must not be
presented as fresh measurements of the amended commit.
