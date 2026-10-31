# Additional unit roles and fleet replacement

Status: mixed implementation and planning, 2026-10-31. Escort replacement,
transport interception and reassessed coastal sentry behavior are implemented
in the accompanying change. New production policies for submarines, cruisers
and battleships, bombardment coordination and air combat remain proposals.

## Goal

Build units for useful tasks, then replace losses while those tasks remain
necessary. Preserve continuous army supply, transport production, city guards
and small neutral expeditions. New ship types should not delay every invasion
until an ideal fleet exists.

The [manual strategy research](manual/strategy.md) documents these roles; it does
not specify the original computer player's algorithm. Proposed allocation and
production decisions are modern AI experiments.

## Role plan

| Unit | First useful AI roles | Production trigger | Reassignment or replacement |
| --- | --- | --- | --- |
| Submarine | Intercept known enemy shipping; patrol a useful sea corridor; watch approaches to a remembered enemy port | Observed shipping activity, a reachable interception area, and enough transport/escort capacity to keep expansion supplied | Recompute corridor value after contacts age or ports change owner; replace a loss only while a useful task remains |
| Cruiser | Detect submarines, protect shipping lanes, support a landing by attacking exposed coastal armies | An expedition faces coastal defenders or submarine risk that existing support cannot address; a suitable coastal factory can finish the ship in useful time | Stay with the supported operation or switch to a threatened route; compare repair versus replacement after damage |
| Battleship | Concentrated surface combat and bombardment against difficult coastal resistance | A sustained, observed heavy-combat task justifies its long production time and does not consume the only transport/army supply factory | Retarget when the original threat disappears; avoid building a replacement solely to restore a historical fleet count |
| Destroyer | Transport escort, anti-submarine detection, interception of hostile transports, coastal patrol and sentry | Protect existing transport traffic and respond to observed naval threats, independently of unexplored terrain | Replace missing coverage after losses; assign nearby available hulls while replacements are built |
| Fighter | Reconnaissance ahead of landings, interception, attacks on exposed armies or ships, local air cover | A useful mission has a fuel-safe return route to a city or carrier | Reassess after base loss or movement; replace aircraft for remaining useful coverage, not just because an empty carrier exists |
| Carrier | Mobile basing for fighters supporting distant operations | Aircraft and a feasible offshore station can serve useful missions beyond city-based reach | Keep aircraft and hull assignments consistent after losses; replace a hull only if mobile basing is still needed |
| Army | Capture, inland assault, reinforcements, exploration and defensive interception | Maintain mobile capture supply as well as required city guards and transport loads | Captures consume attackers as garrisons; replenish successful expeditions as well as casualties |
| Transport | Neutral expansion, concentrated invasion delivery, reinforcement shuttles and recovery | Available or credibly producible troops have a useful crossing or reinforcement route | Replace lost carrying capacity while demand survives; redistribute hulls between operations rather than restarting every mission |

## Rules that constrain tactics

- Only armies capture cities. Bombarding a coastal army does not capture its city,
  destroy its production, or create a blockade modifier.
- Cruisers and battleships can bombard coastal armies through ordinary combat.
  Destroyers and submarines cannot substitute for that role. Re-evaluate after
  each encounter rather than assuming several planned attacks remain legal.
- Submarines cannot detect armies or fighters with their own observation alone.
  They cannot initiate attacks on those units under the current rules. They are
  shipping attackers, not independent beach-reconnaissance platforms.
- Destroyers, cruisers and cities can detect submarines under the current
  detection model. Shared faction knowledge does not permit attacks on hidden
  contacts or convert stale sightings into live target positions.
- Carrier movement changes aircraft return feasibility. A carrier task needs a
  station/aircraft plan; moving a bare hull toward an enemy coast is insufficient.
- Stationed units do not add intrinsic city defense. Defensive interception,
  city guards and ship support need separate assignments.

The manual findings still identify unresolved combat factor application and
original DOS timing. Verify those rules before treating current self-play as
evidence that submarines or heavy ships have historically accurate combat value.
Planning can proceed without inventing new bonuses or changing combat odds.

## Shared task allocation

Use a small role/task record separate from player standing orders. Store its
purpose, unit IDs, operation or route reference, known destination, reassessment
deadline and release reason. Recompute routes from current private knowledge.

Count surviving assigned units and committed construction against each task's
need. Reserve a unit once so the same destroyer cannot satisfy several distant
convoys. An unavailable or unreachable hull is not equivalent to local escort
coverage. Avoid subtracting one casualty from several independent demand totals.

After a loss:

1. Reassess whether the protected operation, route or base still needs the role.
2. Reassign a reachable spare where useful, preserving its prior task's minimum
   coverage. Re-evaluate loaded transport risk while coverage is absent.
3. Assign replacement construction once, considering other factories already
   building replacements. Preserve useful construction progress and troop supply.
4. Release excess commitments if an operation ends or the strategic demand changes.

There is no proposed fixed global production cap or reserve-based production
pause. Demand, production time and geography determine assignments. Continuous
production does not imply that every factory should build the newest ship type.

## Implementation order and verification checklist

- [ ] **Escort task allocation:** reserve destroyers for active convoys before
  discretionary exploration; keep port lanes clear; replace lost coverage and
  avoid duplicate construction assignments.
- [ ] **Cruiser landing support:** identify legal coastal army targets, use normal
  combat, and coordinate safe transport delivery after fresh intelligence.
- [ ] **Submarine interception:** pursue fresh shipping contacts and patrol useful
  remembered corridors; avoid hidden-target pursuit and impossible ground roles.
- [ ] **Air combat and moving carriers:** extend existing reconnaissance with
  target selection, actual launch/return cycles and moving/lost-base fuel checks.
- [ ] **Battleship concentration:** add only after support demand and comparative
  production cost can be evaluated; keep small expansion viable without one.

For each increment, test normal production-to-task execution, losses, target
ownership changes, completed reconnaissance, unreachable assignments and
deterministic save/resume. Compare paired campaign seeds and swapped starts;
include larger city populations, narrow coasts and low-production economies.

Measure protected cargo deliveries, loaded-transport losses, useful interceptions,
successful coastal support, fleet production cost, time without escort coverage,
aircraft survival and city gains/retention. More naval hulls or combat events alone
do not establish strategic improvement. Track AI turn time as task counts grow.

## Implemented transport interception and coastal sentries

Destroyers, submarines, cruisers and battleships search charted navigable cells
for a shortest route to a fresh enemy transport contact. Pursuit takes precedence
over discretionary reconnaissance and holding; ordinary movement and combat
remain authoritative. Recompute after each move. Do not pursue stale positions
as live targets or cross hidden terrain. Transports and carriers keep their
delivery and basing duties; fuel-safe fighter interception remains future work.

After immediate contacts, destroyers retain reconnaissance priority. All four
combat ship types can then approach a loaded friendly transport and hold beside
it. Without that duty, they assess charted connected landmasses. Perimeter stations
qualify only beside a region containing a friendly city and no remembered hostile
city or fresh enemy contact ashore. They prefer stations near owned cities, spread
away from nearby friendly combat ships and avoid stationing next to friendly ports. A station needs several sea neighbors; this reduces obvious
congestion but does not prove that all narrow-channel traffic remains clear.

These are reassessed AI duties rather than permanent player Sentry orders. A
new fresh transport contact can trigger interception on the next AI action.
Regression matches show ships leaving idle corners and settling along a coast,
spaced stations, port separation, reaction to new contacts, and replay. Unknown
shoreline and impassable map borders do not qualify as coastal stations. Tests
also reject a landmass with a fresh invader or remembered hostile city and select
another friendly landmass instead. A stale unit report alone is not proof of a
present enemy. Unknown interiors remain reconnaissance gaps: this is a perimeter
around the known friendly region, not a claim that unseen territory is secure.
Available hulls cover useful spaced stations rather than guaranteeing a continuous
closed ring around every coast.

Current limitations: no shared hunter allocation prevents several ships chasing
one transport; pursuit can draw a ship away from convoy protection; escort choice
still favors the nearest loaded transport rather than balancing coverage across
operations. New ship-type production and coordinated shore bombardment are not
introduced. Army capture and transport supply remain higher priorities than
adding stationary army coastal screens.

## Immediate escort replacement correction

Previously, the two-destroyer transport-protection demand depended on having a
surviving destroyer and at least three local armies. Destroyer commissioning also
needed reconnaissance or an observed transport threat. Losses, embarkation or a
fully explored map could therefore suppress replacements.

The accompanying change keeps a two-destroyer demand floor while transports
exist, with the existing city-count scaling above it. It permits construction
without a reconnaissance frontier. Surviving hulls and other factories' assigned
production count toward demand; committed useful construction retains progress.
An undefended city still prioritizes an army. This is fleet inventory replacement,
not yet operation-specific escort assignment or guaranteed local convoy coverage.

Regression checks cover losing one or all escorts after map exploration with
troops already aboard, construction completing through ordinary turns, replay,
guard retention and duplicate-factory avoidance.

## References

- [Manual strategy](manual/strategy.md), printed pp. 21–28 and 55–57.
- [Manual findings](manual/findings.md), particularly MF-02 and observer rules.
- [Unit statistics and damaged capacity](../src/engine/units.ts).
- [Combat legality](../src/engine/adjudication.ts).
- [Carrier reconnaissance already implemented](AI_AIR_OPERATIONS.md).
- [Invasion implementation guide](TECHNICAL_IMPLEMENTATION_PLAN.md#5-coordinated-invasions-and-logistics).

## Verification and campaign observations

291 engine tests and four bundle checks pass. Engine coverage is 98.05% lines
and 94.65% branches. The carrier-production fixture now supplies two destroyers
so it isolates carrier commissioning after the transport's protection demand is
satisfied; it still requires normal completion of carrier production.

Six clean 150-round campaigns use the same seeds and layouts as PR #32, with
valid end-state saves. These are 12-city stress maps, not representative coverage
of the manual's denser worlds. Values below list Blue / Red.

| Layout | Seed | Prior cities | Current cities | Prior landings | Current landings |
| --- | --- | --- | --- | --- | --- |
| continents | 17 | 5 / 2 | 5 / 2 | 0 / 0 | 0 / 0 |
| continents | 83 | 5 / 2 | 5 / 2 | 0 / 3 | 0 / 2 |
| islands | 17 | 1 / 2 | 1 / 2 | 0 / 3 | 0 / 3 |
| islands | 83 | 3 / 1 | 2 / 2 | 0 / 2 | 3 / 2 |
| archipelago | 17 | 1 / 1 | 1 / 1 | 2 / 0 | 2 / 0 |
| archipelago | 83 | 3 / 1 | 3 / 1 | 4 / 2 | 3 / 2 |

The islands/83 ownership split changes from 3 / 1 to 2 / 2; most final city
counts are unchanged. Different landing totals are not evidence of better
invasions by themselves. These samples do not establish a general campaign
strength improvement or quantify hunter/sentry effectiveness. The regression
matches establish those specific behaviors. [Raw results](evaluation/2026-10-31-naval-perimeters.json).
