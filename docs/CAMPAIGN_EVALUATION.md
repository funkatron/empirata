# Campaign evaluation

These are modern experimental strategy measurements, not evidence of original
DOS AI behavior. The round-494 save motivated investigation of small isolated
landings, undiscovered cities, and loaded transports without useful progress.
It is diagnostic evidence, not a strategy benchmark or a save-repair target.

## Coordinated landing policy

Transports assigned to the same remembered city plan one wave before unloading.
The planner matches ready armies to distinct safe, charted beach squares beside
their own transports. Matching preserves restricted landing cells for ships
that cannot reach the other cells. Friendly armies already within two squares
of the objective count as support only if a charted land approach exists.

The planned landing force plus that support must outnumber freshly sighted
enemy armies within three squares of the objective. Stale reports retain their
existing beach preference penalty but do not impose a permanent force minimum.
An undefended objective can still receive a single army. Existing threat
avoidance and mission retry delays continue to apply.

This is a provisional force-count heuristic. It does not estimate combat odds,
make ships rendezvous, coordinate production, or guarantee conquest. A narrow
beach or insufficient force can cause a mission to wait and eventually time out.
Fighter strategy remains a separate roadmap item.

## Reproduce broader observations

```sh
npm run evaluate:campaigns
CAMPAIGN_ROUNDS=120 CAMPAIGN_SEEDS=1,7 npm run evaluate:campaigns
CAMPAIGN_MAPS=archipelago CAMPAIGN_SEEDS=42 npm run evaluate:campaigns
```

Defaults: 200 rounds, seeds 1/7/42, three map families. The optional command is
outside normal CI. Each generated 100×60 map starts with one coastal city per
side, eight neutral cities, no units, no production progress and only initial
city visibility. Continents, archipelagos and broken coasts use different sizes
and counts of randomly positioned ellipses. Cities are dispersed over generated
land; no voyage, target intelligence, cargo, production completion or harbor
channel is prepared. These are still synthetic maps and do not represent the
full range of maps or balanced competitive openings.

The command emits one JSON object per campaign. It records production,
landings, captures, knowledge coverage, rounds since the last capture, paused
factories, cargo, city objectives and distinct loaded-transport positions.
`landingOpportunityTurns` counts transport-turn observations with a charted
beach option, not actual attempted landing orders. `removedUnits` includes
armies consumed as permanent city garrisons and must not be called casualties.
Loaded transport and cargo loss counters compare round-boundary snapshots;
they can miss a ship produced and destroyed within one round. Cargo integrity
is checked every round and a current-version save/load is exercised mid-run.

To compare strategy revisions, run the same harness and map generator against
separate builds of both revisions using identical family, seed and round
budgets. Do not select seeds solely because they produce successful invasions.

## Paired results — 2026-10-28

Baseline: deployed commit `460092eb4fb2424d7879731c71d1ac6b561fc351`.
Candidate: the coordinated landing planner in this PR. Both builds used the
same generator, seeds 1/7, three families, and 120 rounds: twelve campaign runs
in total. Every run completed the cargo integrity and mid-run save/load checks.

| Family | Seed | Final cities B/R, baseline → candidate | Captures, baseline → candidate | Landings, baseline → candidate |
|---|---:|---|---|---|
| continents | 1 | 2/4 → 2/4 | 5 → 5 | 5 → 5 |
| continents | 7 | 2/4 → 2/4 | 4 → 4 | 6 → 6 |
| archipelago | 1 | 2/2 → 2/2 | 2 → 2 | 2 → 2 |
| archipelago | 7 | 1/2 → 1/2 | 1 → 1 | 3 → 3 |
| broken-coast | 1 | 2/3 → 2/3 | 3 → 3 | 4 → 4 |
| broken-coast | 7 | 3/3 → 3/3 | 4 → 4 | 6 → 6 |

This sample establishes no campaign-level improvement in city holdings, capture
counts or landing counts. Five pairs have identical recorded telemetry. In
continents/1, final holdings and capture/landing totals match, but movement,
production, surviving units and capture timing differ. The focused tactical
tests demonstrate coordination behavior; they do not establish a win-rate gain.

Both revisions still fail to expand Blue beyond its initial city on
archipelago/7. Red on archipelago/1 has two cities but no landings and no new
capture for 99 rounds. Loaded ships can travel widely while making little
strategic progress. Force recruitment, rendezvous and useful approaches deserve
further investigation across these failed campaigns before tuning thresholds.
No sampled round-boundary loaded-transport losses occurred, so the loss counters
do not establish that the policy reduces cargo casualties.

Raw observations: [baseline](evaluations/landing-wave-baseline.jsonl) and
[candidate](evaluations/landing-wave-candidate.jsonl). These small fixed seeds
are reproducible diagnostics; additional unseen seeds and longer runs remain
necessary for stronger claims.
