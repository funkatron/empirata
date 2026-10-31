# Beach rendezvous with inland movement

## Behavior

An empty transport can choose a coast where at least two eligible mobile armies
can meet it. Each army searches up to eight charted land steps for an ordinary
beach; the ship searches charted sea and friendly ports. Routes exclude fresh
contacts, threatened pickup squares and known hostile cities. No hidden terrain
or enemy positions are consulted.

Candidate loading stations group distinct armies from all adjacent beaches.
Rank by estimated arrival time of ship and slowest walking army per available
cargo slot. Compare against an optimistic nearby friendly-port supply estimate;
retain the port policy when that estimate is cheaper. This is a local heuristic,
not a globally optimal multimodal route solver.

The ship reserves its troop IDs for the pickup. Other ships cannot reserve those
same troops during the planning pass. Assigned armies walk by ordinary movement,
wait when obstructed, and board through ordinary embarkation. A partially loaded
ship keeps collecting its committed group instead of sailing after the first
army boards. Discretionary recon drops and landing waves do not unload cargo
while a pickup commitment is active.

The commitment retains its original start round and expires after twelve rounds.
If a feasible plan disappears, release the commitment and use existing transport
behavior. The next planning pass may find another pickup. The new state is
validated on save import; existing-save repair is not required.

## Preserve other duties

City defenders and active reachable beachhead assaults remain excluded by the
boarding protection policy. Armies with reachable known land objectives keep
those objectives; the designated mobile scout retains useful reconnaissance.
Sentry armies do not board. An initial pickup needs two troops to avoid removing
a lone explorer or assault survivor; a committed pickup can finish with one
remaining army. Newly produced mobile troops in a city may participate without
collecting its reserved defender.

## Verification

- A ship approaches a beach and loads six armies without a city or port.
- Inland armies march to shore and board on successive turns while the ship
  retains its commitment; save/reload replay matches.
- Protected troops, sentries, fresh threats and unknown routes are excluded.
- Reachable ground capture objectives retain their armies.
- Existing scouting, port approach, city defense and anti-reboarding regressions
  remain in the full suite.

## Limits

The eight-step land search bounds local pickup planning. Distant inland marching,
long-term troop reservations across several operations, isolated single-army
recovery and production forecasting remain future work. Congestion can delay
arrival and expire a commitment. Assignments are sequential and local, and fresh
intel can change the selected coastal station. Known naval contacts block their
occupied squares; comprehensive escort/risk scheduling is separate work.

The port comparison is an estimate, so this does not establish that all pickup
choices save time. Profile larger fleets before claiming a speed improvement.

## Release checks

303 engine tests pass, with 98.18% line and 95.06% branch coverage. Four bundle
checks and six observer coordinator checks pass. Six clean 100-round campaigns
cover continents, islands and archipelago with seeds 17 and 83; all final saves
validate. These are 12-city stress maps. Landing activity remains limited, and
there is no general campaign-strength improvement claim. These 100-round samples
are not directly comparable to earlier 150-round city totals.
[Raw campaign results](evaluation/2026-10-31-beach-rendezvous.json).
