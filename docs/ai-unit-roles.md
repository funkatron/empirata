# AI unit roles

## Current change

City guards remain stationed. Ground reconnaissance now selects a mobile army,
excluding those guards, regardless of fleet size. This repairs a conflict between
city defense and exploration; only armies can turn discoveries into city captures.

Destroyers prioritize fresh enemy transports, then useful reconnaissance. When
reconnaissance yields no route, they approach a known sea station beside the
nearest loaded friendly transport, or hold position. They reassess every turn;
this is not a permanent sentry order. Routes and stations use faction knowledge.
A corner location alone does not prove that reconnaissance is complete.

The existing player sentry, patrol and escort orders remain available. These
experimental AI roles do not change their rules or claim DOS strategy parity.

## Proposed assignments

| Unit | Sentry | Patrol | Escort |
| --- | --- | --- | --- |
| Army | City guard; implemented as reserved troop | Nearby land frontier or threatened approach | Protect beachhead after unloading; cannot accompany ships at sea |
| Destroyer | Hold and reassess when no useful assignment | Known sea corridor and fresh contacts | Loaded transports; initial fallback implemented |
| Submarine | Known naval approach | Interception lanes, respecting detection rules | Evaluate interception ahead of convoy rather than assuming close escort is best |
| Cruiser / battleship | Threatened harbor approaches | Contested routes | Concentrated protection where observed threats justify production cost |
| Fighter | Friendly base with fuel reserve | Fuel-budgeted reconnaissance and interception | Air cover only with safe return/refueling path |
| Carrier | Safe staging base | Operate with aircraft and surface protection | Support an expedition after reliable fighter basing exists |
| Transport | Wait for troops at friendly supply | Avoid empty routine patrols | Receive escort; retain army delivery as primary role |

These are proposals unless marked implemented. Do not start producing every unit
type just because a role is available. Fleet composition needs campaign evidence.

## Next verification

- Allocate escorts across multiple expeditions rather than clustering all idle
  destroyers beside the nearest transport.
- Introduce useful corridor patrols only after fresh threat response, route
  coverage, reassignment and bounded computation can be measured.
- Record role transitions and time spent holding to diagnose corner loitering.
- Evaluate fighter fuel/refueling and original combat/detection rules before air
  patrols; retain manual/executable uncertainty explicitly.
- Follow ordinary campaigns from neutral-city discovery through landing and
  capture. More scouting is not sufficient proof of better conquest.

## Coastal sentries and enemy-port interception

Requested follow-up: assign surplus naval units to known friendly coastal-city
approaches, prioritizing observed threats and active troop-loading ports. Choose
legal, charted sea stations that leave friendly departures and cargo loading
accessible. Reassess after discoveries, losses and changes in city ownership.

For a known enemy coastal city, consider occupying a useful sea approach and
intercepting freshly detected traffic. A blockade is tactical positioning under
existing movement/combat rules: it does not disable production, add an upkeep
penalty, or let ships capture a city. Evaluate escape routes, enemy ground attack
range, ship repair needs and expedition escort demand before committing hulls.

Both roles remain proposed. Tests should cover friendly port congestion,
ownership changes, hidden-world equivalence, stale threat reports and timely
reassignment. Measure intercepted traffic and protected departures, not merely
turns spent next to a city.
