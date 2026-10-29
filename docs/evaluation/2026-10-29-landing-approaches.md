# Usable landing approaches

## Problem and change

Transport navigation and landing selection disagreed about usable beaches.
Navigation treated a hostile city itself, or a friendly occupied shore square,
as a possible landing. It could hold beside that square while actual unloading
correctly rejected it, even when a free beach was just around the coast.

Both planners now use the same knowledge-limited check: charted land, no city,
no fresh occupant, no friendly occupant, and no adjacent freshly sighted enemy
army. Stale contacts retain their existing advisory role. A transport continues
its approach until it reaches a sea square beside an available beach. Existing
land connectivity, objective persistence, threat avoidance, wave readiness and
per-landing safety revalidation remain in place.

This changes experimental strategy, not the game's movement or combat rules.

## Verification checklist

- [x] Reproduce a ship holding beside a city that cannot receive cargo.
- [x] Reproduce friendly and fresh enemy beach occupants causing the same issue.
- [x] Move around the coast, then hold beside an available beach.
- [x] Keep stale contacts from permanently prohibiting an approach.
- [x] Complete an actual approach, landing and city capture through normal rules.
- [x] Pass 196 tests and engine coverage gates; pass 4 bundle checks.

## Diagnostic limits

Not every idle transport has this defect. On islands/17 at round 201, Blue's
transport was in a fully explored 128-cell enclosed sea. It knew no overseas
city objective. Blue's land scout was still exploring a much larger landmass:
charting continued after round 201. This fix does not create a sea passage,
repair the generated map, or guarantee expansion from that starting position.

## Paired generated-map evaluation

Baseline: deployed `83d4660ea7d510154bb1cb3aa01003331bb82662`.
Candidate: the approach fix in this PR. Run both policies in self-play on
identical generated maps and initial random states. Use continents, islands and
archipelago layouts; seeds 17 and previously unused 101; 200 rounds each. Add
one archipelago/101 comparison with starting faction locations swapped.
Fourteen runs total cover seven paired settings and 2,800 simulated rounds.

Each side starts with one city, no units, zero production progress and only
city sight. No cargo, objectives, transport routes or outcomes are prepared.
The existing evaluator validates every final save using normal import rules.
Different actions change subsequent random draws; final counts do not isolate
the contribution of a particular combat result. This sample does not establish
win rate, general strategic superiority or original DOS AI fidelity.

Reproduce after building both revisions:

```sh
SEEDS=17,101 ROUNDS=200 node scripts/evaluate-ai.mjs > candidate.json
EMPIRATA_ENGINE=/path/to/baseline/dist/engine/index.js \
  SEEDS=17,101 ROUNDS=200 node scripts/evaluate-ai.mjs > baseline.json
SWAP=1 SEEDS=101 LAYOUTS=archipelago ROUNDS=200 \
  node scripts/evaluate-ai.mjs > swapped-candidate.json
EMPIRATA_ENGINE=/path/to/baseline/dist/engine/index.js \
  SWAP=1 SEEDS=101 LAYOUTS=archipelago ROUNDS=200 \
  node scripts/evaluate-ai.mjs > swapped-baseline.json
```

## Results

| Layout / seed | Swapped | Cities B/R, baseline → candidate | Landings B/R, baseline → candidate |
| --- | --- | --- | --- |
| continents / 17 | No | 4/2 → 4/2 | 0/0 → 0/0 |
| continents / 101 | No | 4/3 → 4/3 | 0/0 → 0/0 |
| islands / 17 | No | 1/6 → 1/6 | 0/4 → 0/4 |
| islands / 101 | No | 3/3 → 3/4 | 2/8 → 2/7 |
| archipelago / 17 | No | 2/5 → 2/5 | 6/8 → 6/9 |
| archipelago / 101 | No | 3/6 → 3/7 | 14/10 → 12/14 |
| archipelago / 101 | Yes | 6/2 → 6/3 | 6/7 → 10/17 |

Final city holdings improve by one Red city in three settings and remain
unchanged in four. Blue's final holdings are unchanged throughout. This is
limited evidence of useful campaign progress; no general advantage or victory
rate is established. More landings are not inherently better: islands/101
finishes with one more Red city despite one fewer Red landing.

The known islands/17 opening remains at Blue 1 / Red 6 cities. Enclosed-sea
production decisions, ground exploration speed, recruitment and rendezvous
remain separate work. Fighter strategy remains on the roadmap.

Full measurements and the exact candidate source blob are preserved in
[the raw report](2026-10-29-landing-approaches.json). The previously unused seed
became an observed diagnostic once this run completed; future evaluation should
continue adding unseen seeds rather than repeatedly tuning to 101.
