# Invasion operations: concentrate, deliver, sustain

Status: design review, 2026-10-31. Proposed behavior below is not implemented.
Reviewed against the source through PR #32 and the existing manual research.

## Assessment

The AI has coordinated landing mechanics, but it does not yet reliably create
the force those mechanics need. Increasing transport production alone cannot
ensure that ships collect large loads, depart together, unload effectively, or
bring reinforcements. The next priority is recruitment and supply allocation at
the expedition level.

An undamaged transport carries six armies; damage reduces capacity. The manual's
major-invasion advice of two or three full transports therefore corresponds to
12–18 armies before losses. This is a target for a supported hostile expedition,
not a universal minimum for crossing water or capturing a neutral city.

## Existing behavior and its limits

| Stage | Current behavior | Consequence |
| --- | --- | --- |
| Production | Transport demand grows with army count and known objectives | Counts do not establish a feasible supply chain or army commitment |
| Loading | Ships collect eligible nearby troops in iteration order | Ships compete for supply without a shared loading schedule |
| Departure | A partially loaded ship may sail; recruitment waiting requires a loaded partner | The first ship can leave before a second ship becomes a partner |
| Assembly | Ships with the same objective can rendezvous near the leading ship, usually near the target | This groups available cargo; it does not organize recruitment at home |
| Commitment | Objectives persist independently; a larger hostile group can divert one ship to neutral expansion | No shared operation record preserves the force required by an agreed attack |
| Reconnaissance | A committed transport with at least four armies may drop a scout far from its city objective | The assault reserve can decline to three troops per ship before arrival |
| Landing | Nearby same-objective ships match ready armies to distinct beaches | Limited cargo or beach space lowers the effective wave requirement; it does not guarantee a large attack |
| Ground assault | Delivered armies remain ashore while their beachhead objective is nonfriendly and a ground objective is reachable | Ground movement does not yet preserve a shared expedition command or reinforcement plan |
| Support | Destroyers pursue hostile shipping, then scout, then escort when reconnaissance is exhausted | An invasion has no reserved escort while useful scouting remains |
| Reinforcement | Empty transports seek supplied friendly ports | Ships do not retain an expedition-specific shuttle or delivery schedule |

Source anchors: `chooseAiTransportObjective`, `planAiTransportAssembly`,
`planAiConvoyStaging`, `planAiLandingWave`, `planAiReconLandingSquare` and
`playRedOpponent` in [game.ts](../src/engine/game.ts); transport capacity in
[units.ts](../src/engine/units.ts).

## Proposed operational policy

### 1. Select a feasible operation

Separate small neutral expansion, hostile invasion, reconnaissance and
reinforcement roles. Score a candidate using known sea travel, ground travel,
available troop supply, observed threats and alternate opportunities. Do not
infer that an unseen coastline is undefended. Fresh evidence and uncertainty
should influence risk rather than grant hidden knowledge.

For a major hostile operation, aim initially for two useful transport loads and
consider a third when supply and the objective justify it. Compute capacity from
the actual hulls. Preserve nearby city guards, viable local capture forces and
small neutral expeditions; do not reserve every army for one distant battle.

### 2. Recruit at supply ports before departure

Create one operation record with objective, phase, assigned transports, supply
ports, committed troops, desired strength, viable minimum and progress deadlines.
An empty transport must be eligible for assignment before it carries cargo.

Reserve each army and transport once. Compare the supply available at multiple
ports, walking time to loading squares, sea access and current production.
Estimate when committed troops can actually board; an inland army somewhere on
the same continent is not equivalent to an army waiting at the dock.

Keep factories active. Coordinate production roles with the operation rather
than imposing fixed unit caps or pausing production. Existing mobile troops should
provide the first loads; credible future production can complete them.

Set a feasible departure window from loading and arrival estimates. Do not apply
the existing 12-round rendezvous deadline blindly to recruitment: producing twelve
armies may take much longer than gathering already loaded ships. If a load cannot
be assembled in a useful time, resize, choose another objective or release the
commitment. Do not wait forever for hypothetical ships or troops.

### 3. Sail and land as a force

Use a shared destination and route-aware arrival estimates. Stage at safe water
with enough distinct stations and clear traffic lanes; use separate loading
ports when that avoids congestion. Match arrivals rather than forcing a rigid
formation through narrow channels.

Reserve appropriate naval support when the threat warrants it. A destroyer's
escort duty should not depend on exhausting every reconnaissance opportunity.
Aircraft can update landing intelligence when safe return bases exist. Support
uses ordinary movement and combat: presence grants no invented defense,
bombardment or production-suppression bonus.

Choose several landing squares on the same useful landmass, with routes toward
the operation's city objectives. Prefer concentrated arrival with enough room to
advance. Distant landings are useful when they open a second approach or capture
another city; scattering the entire assault across unrelated islands defeats
concentration.

Beach capacity is a delivery rate, not the total size of the desired invasion.
If six armies can land this turn, move them inland and deliver the next wave as
space clears. Reassess after fresh contact. A committed assault should not spend
its reserved troops on unrelated reconnaissance drops.

Departure and landing decisions must allow a smaller viable force when waiting
costs more than it gains. That exception should have an explicit reason, such as
confirmed local support, a weakened objective or lost reinforcements; it should
not silently arise from having only three troops available.

### 4. Sustain the beachhead

Retain the operation after unloading and after its first city capture. A capture
consumes its attacking army as the permanent garrison, so successive city attacks
require continuing mobile supply even without combat casualties.

Assign empty hulls to return, reload and reinforce while other transports deliver.
Recompute supply ports after losses or captures. Keep delivered assault troops
on ground duties while useful ground objectives remain. End or retarget the
operation explicitly rather than losing its identity at the first objective.

## Implementation order and verification checklist

- [ ] **Recruitment first:** operation identity, empty-ship assignment, unique troop
  reservations, several loading ports and explicit departure decisions. Show two
  transports filling from ordinary city production without stripping guards.
- [ ] **Transit and support:** route-aware scheduling, safe staging and reserved
  escorts. Exercise blocked ports, damaged capacity, a lost ship and an unreachable
  partner without unlimited waiting or abandoning useful small expansion.
- [ ] **Landing and continuation:** distribute a large force across legal beaches,
  advance inland, capture successive cities and deliver repeat waves. Include a
  narrow coast that cannot receive the whole force in one turn.
- [ ] **Campaign evidence:** compare paired seeds and swapped starts across varied
  geography, supply levels and enemy strength. Retain negative outcomes. Test
  larger and denser city populations as well as the current 12-city stress maps.

Keep new planning state separate from player orders. Recompute routes from private
current intelligence, validate persisted operation references and verify deterministic
save/resume. Index cargo, occupancy and operation membership per planning pass;
avoid adding repeated whole-board searches per army when unit counts grow.

## Measures of success

Record operation size and load at departure, recruitment delay, missed departure
reasons, troops delivered over a short arrival window, loaded-transport losses,
time to the next reinforcement, mobile armies left at supply ports, and captures
and retained cities after landing. Also measure AI turn time as units accumulate.

More ships, more landings, or larger departure loads are insufficient individually.
The result should be more useful force delivered and sustained, without starving
neutral expansion or concentrating valuable cargo into avoidable losses. The six
campaigns accompanying PR #32 still have mixed capture outcomes; they establish
neither a strong invasion policy nor a general improvement in campaign strength.

## Supporting material

- [Manual strategy research](manual/strategy.md), especially printed pp. 55–57.
- [Implementation guide, section 5](TECHNICAL_IMPLEMENTATION_PLAN.md#5-coordinated-invasions-and-logistics).
- [Inland landing and reboarding correction](AI_INLAND_INVASION_FIX.md).
- [Route-aware progress and campaign comparison](AI_INVASION_ROUTE_PROGRESS.md).
