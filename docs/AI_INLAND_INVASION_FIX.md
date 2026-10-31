# Inland invasion landing correction

## Failure

Approach planning searched only a five-by-five area around a known city, and
unloading rejected beaches more than two squares from that city. A large island
with an inland objective could therefore have a safe, fully charted coast and
land route while no invasion beach was considered usable. The existence of a
transport or a convoy could not overcome that geographic exclusion.

## Implementation

Build a reverse connected region from eligible known nonfriendly city objectives,
traversing confirmed land and friendly cities. Stop at unknown terrain, water and
other nonfriendly cities. Scan that region for unoccupied safe beaches, then let
the existing sea approach planner route toward their adjacent water. Navigation
and unloading use the same connectivity requirement, without a fixed city-distance
limit. Keep occupied-shore and fresh-threat checks.

The region is built once per approach search rather than running a separate
land-route search for each candidate beach. This bounds an approach's land search
and candidate scan by the fixed board size. No overall performance improvement is
claimed without profiling.

Convoy staging can activate at a usable connected coastal approach even when the
inland city is more than six squares away. It retains existing wait deadlines,
route estimates and gathered-state behavior.

## Verification

- An actual transport approaches, unloads three ordinary armies on a distant
  connected shore, and those armies capture the inland objective using normal
  movement/combat. Save/reload continuation matches each turn.
- An unknown land gap cannot qualify that shore as a route to the city.
- A convoy recognizes a usable coast far from the objective.
- Existing city-only-shore, occupied-beach and threat regressions remain intact.

## Remaining limits

This removes one definite invasion blocker, not every logistics limitation.
Nearest navigable delivery may still trade sea travel for a longer ground march;
combined sea/ground travel-time scoring is future work. City-only islands without
an ordinary landing square remain a separate rules/landing question. Mission
progress now uses the remaining sea route to a usable connected beach when one
can be planned; see [route progress](AI_INVASION_ROUTE_PROGRESS.md).
Existing arbitrary-world connectivity and stale intelligence uncertainties remain.

## Protect the land assault after delivery

The AI computes a separate boarding-exclusion set for AI-delivered unembarked armies with a
persisted beachhead objective and a reachable ground objective or adjacent
nonfriendly city. Newly recruited troops remain eligible for transport loading. Explicit loading
and automatic port-departure pickup both respect that set. City guards remain
separately protected; assault troops are not frozen by the guard movement rule.
This prevents a newly delivered ground force near a friendly supply port from
being carried away again instead of attacking inland.

Regressions verify that troops stay ashore and advance during both nearby loading
and departure from a friendly port. These are ordinary turns with normal army
movement, not scripted capture outcomes.

## Six clean 150-round campaign observations

Same layouts/seeds as the supply-backlog sample. Values list Blue / Red.

| Layout | Seed | Prior cities | Current cities | Prior landings | Current landings |
| --- | --- | --- | --- | --- | --- |
| continents | 17 | 5 / 2 | 5 / 2 | 0 / 0 | 0 / 0 |
| continents | 83 | 5 / 3 | 5 / 3 | 0 / 1 | 0 / 0 |
| islands | 17 | 1 / 2 | 1 / 2 | 0 / 3 | 0 / 0 |
| islands | 83 | 3 / 2 | 3 / 1 | 0 / 1 | 0 / 0 |
| archipelago | 17 | 1 / 1 | 1 / 1 | 2 / 0 | 2 / 0 |
| archipelago | 83 | 3 / 2 | 3 / 1 | 3 / 3 | 4 / 2 |

All final saves validate. Some city totals regress and several settings still have little shipping; no general improvement claim is warranted. Reduced landing counts can reflect preventing reboarding cycles or using ground forces directly, so these counts alone are not a success measure. The end-to-end regression establishes the specific inland-city delivery/capture behavior. [Raw results](evaluation/2026-10-31-inland-invasions.json).

The autonomous-match voyage oracle now requires a loaded ship to change sea
position, rather than visit at least three cells regardless of the available
shore. The expanded valid coast shortened Red's observed crossing to two loaded
positions in that fixture. The separate production-to-overseas-capture campaign
retains its three-cell voyage check and capture requirement. This change avoids
rewarding a longer sea route solely to satisfy an arbitrary threshold.
