# Fighter starvation and troop pickup correction

## Confirmed planner defects

The fighter prerequisite required the faction's army count to cover every existing
transport slot. Transport demand simultaneously rounds army demand up to six-slot
ships, so newly completed transports could repeatedly make the fighter prerequisite
false. This was a policy conflict, not a missing unit definition or build action.

Empty ships also selected the nearest friendly port without considering queued
mobile troops, and could stay at a barren port indefinitely. Surplus armies stopped
on adjacent port approaches, allowing stationary troops to obstruct later arrivals.

## Corrections

- Remove the faction-wide transport-slot prerequisite for fighters. Two local
  armies suffice for the first aircraft decision when a fuel-feasible scouting
  opportunity exists. Preserve defender priority and committed production.
- Missing transport capacity at supplied coastal factories still comes first.
  Once that demand is assigned, prioritize the first fighter before extra scouts.
  A transport fleet raises the initial aircraft demand to two, enabling the
  existing carrier prerequisite instead of leaving a one-city fleet permanently
  limited to one fighter.
- Rank empty-ship destinations by actual nearby queued, connected, unembarked
  mobile troops, excluding city defenders, then distance. A barren current port
  no longer suppresses departure toward a supplied one. Try other ports when a
  route fails; never grant cargo or teleport a pickup.
- Armies prefer ports with nearby transport capacity and enter friendly cities
  instead of stopping around them. City stacking is legal and frees approaches.

## Evidence and limits

The new regressions verify production despite spare transport slots, departure
from a barren port, and actual boarding after a supply trip through normal turns.
Existing city-defense and scout tests explicitly supply aircraft or exhausted
reconnaissance when isolating other production roles; they no longer silently
assume that the production planner cannot request fighters.

Generated-map reports now enumerate fighters, carriers, embarked armies and
unembarked armies. These counts complement production/boarding/landing events;
a final zero embarked count alone does not imply that no troops were delivered.
Conversely, aircraft completion in a prepared fixture never established that
ordinary campaigns would choose aircraft production often enough.

These changes address specific starvation and routing defects. They do not prove
that every stranded army can reach a usable port, that every port accesses the
same ocean, or that all known-city missions are reachable. Longer campaigns,
multiple supplied ports and congested approaches remain important evaluation cases.

## Six clean 150-round campaigns

Each cell lists Blue / Red. Final aircraft counts are survivors, not total production.

| Layout | Seed | Fighters | Transports | Armies ashore | Boarding events | Landing events |
| --- | --- | --- | --- | --- | --- | --- |
| continents | 17 | 2 / 1 | 0 / 0 | 54 / 38 | 0 / 0 | 0 / 0 |
| continents | 83 | 2 / 2 | 1 / 1 | 18 / 11 | 0 / 1 | 0 / 1 |
| islands | 17 | 2 / 2 | 1 / 1 | 3 / 3 | 0 / 3 | 0 / 3 |
| islands | 83 | 2 / 2 | 1 / 1 | 8 / 1 | 0 / 1 | 0 / 1 |
| archipelago | 17 | 2 / 2 | 1 / 1 | 2 / 3 | 2 / 0 | 2 / 0 |
| archipelago | 83 | 2 / 2 | 2 / 1 | 10 / 3 | 6 / 3 | 3 / 3 |

All twelve faction outcomes retain one or more fighters. Boarding and landing remain limited in several settings; this is evidence of aircraft selection and some troop delivery, not completion of the larger logistics problem. All six final saves pass validation. [Raw results](evaluation/2026-10-31-supply-backlog.json).
