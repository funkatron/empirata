# Fleet growth and distributed landings

## Behavior

- Transport demand grows with available armies (one per six armies, maximum four).
- Destroyer demand grows with city count, supplied transport fleets and fresh enemy transport sightings (maximum four). Factories already assigned to ships count toward demand. Committed production retains progress while that demand remains.
- Destroyers attack adjacent freshly sighted transports before scouting, or approach a freshly sighted transport using charted sea approaches. Stale contacts do not trigger pursuit.
- New loaded transports prefer known cities without another assigned transport. Existing missions remain stable; shared assaults remain possible when no other objective is known.
- With no active city mission, a transport may land one army at a safe charted land frontier. Nearby supply and scouts suppress duplicate drops within eight squares; distant drops on the same charted region remain possible. Remaining cargo stays aboard.
- Ground reconnaissance selects a scout per nearby group rather than one for the entire faction, so distant landed scouts can explore.

The four-ship limits, eight-square spacing and force ratios are provisional strategy choices, not historical DOS rules. Reconnaissance drops are opportunistic; dedicated persistent coastal waypoint missions and diversion of assault cargo are not implemented. Combat and movement still use normal rules and faction intelligence. No save migration is included.

## Verification

- [x] 202 tests pass, including second-ship production, assignment distribution, reconnaissance spacing and fresh/stale transport combat.
- [x] Four bundle checks pass; engine coverage gates pass.
- [x] A direct integration check lands one reconnaissance army and retains the second aboard.
- [x] Three paired generated-map campaigns run for 200 rounds each (1,200 simulated rounds), with ordinary final-save validation.

## Campaign evidence

Baseline is deployed `527fe21`. Use the existing generator, seed 101 and the same initial orientation in both self-play versions. No forces, paths or objectives are prepared. Counts below are final holdings/survivors, not cumulative production.

| Layout | Cities B/R, before → after | Destroyers B/R, before → after | Transports B/R, before → after |
|---|---|---|---|
| continents | 4/3 → 6/4 | 0/0 → 0/0 | 0/0 → 0/0 |
| islands | 3/4 → 7/0 | 1/1 → 4/1 | 1/1 → 3/1 |
| archipelago | 3/7 → 3/8 | 1/1 → 2/2 | 1/2 → 3/3 |

Fleet growth occurs in both naval layouts. Outcomes change substantially: Blue gains cities on islands while Red loses all its cities. These three maps do not establish balance or a general strategic improvement. Both factions use the changed policy; changed actions alter combat random draws. Continental expansion also changes because ground scouting is distributed. Isolating each policy's contribution, additional seeds, swapped starts and longer campaigns remain evaluation work.

Raw data: [fleet-growth.json](2026-10-30-fleet-growth.json).

```sh
SEEDS=101 ROUNDS=200 node scripts/evaluate-ai.mjs
EMPIRATA_ENGINE=/path/to/built/baseline/dist/engine/index.js \
  SEEDS=101 ROUNDS=200 node scripts/evaluate-ai.mjs
```
