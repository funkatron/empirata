# Strategy and tactics from the manual

Source: printed pp. 20–28 and 54–57; strategy spreads and pp. 22–27 visually
checked. These are paraphrased recommendations for human play. They neither
prescribe an immutable AI build order nor reveal the original computer algorithm.

## Campaign phases

| Phase | Manual advice | Modern AI experiment | Evidence to collect |
| --- | --- | --- | --- |
| Opening, p. 54 | Armies are a beginner-friendly first choice; one or two fighters can accelerate discovery before switching to armies | Compare safe fighter reconnaissance with ground-first openings | Time to discover and capture reachable cities; aircraft survival; production cost |
| Home expansion, p. 55 | Capture the starting landmass; newly captured inland cities produce armies | Assign reachable neutral objectives to mobile armies without suppressing city defense | Discovery-to-assault delay; blocked army turns; capture attempts |
| First crossing, pp. 54–55 | Produce transports early at a captured coastal city and stage armies before completion | Match port production, nearby troop supply and known overseas opportunities | Empty departures, loading delay, first overseas capture |
| Coastal reconnaissance, pp. 22–23, 55 | Early destroyers reveal coastlines/cities and locate opponents | Separate valuable cargo from risky reconnaissance; spread scouts across frontiers | Useful cities revealed per production turn; repeated coastal visits |
| Expansion, pp. 55–56 | Forward production favors armies, fighters and lighter naval units; rear cities can build heavy ships | Let geography and current operations influence factory roles | Travel time to front, convoy replacement time, threatened factory losses |
| Major invasion, p. 56 | Two or three full transports, coordinated unloading, naval/air support, then quick reinforcement | Explicit staging and arrival scheduling across distant transports | Troops landed within a short interval, beachhead survival, follow-up delivery |
| Ongoing war, p. 57 | Continue neutral expansion instead of committing everything to an early enemy encounter | Reserve expedition capacity for reachable neutral land | Neutral captures during war; opportunity cost of failed hostile missions |

The manual recommends transports as the first ship type (p. 55), while also
strongly recommending early destroyers (pp. 22–23, 55). Our early destroyer-first
choices are modern experiments, not literal adherence to its suggested sequence.
Likewise, its fighter opening is advice, not a requirement to produce a fighter
when there is no safe or useful mission.

## Roles beyond reconnaissance

| Unit | Documented use | Consequence for planning |
| --- | --- | --- |
| Army | Capture, reinforce, guard rear ship-producing cities (pp. 21, 56) | Preserve capture supply; place defensive troops where they can intercept |
| Fighter | Scout, fight armies/ships/aircraft, protect landing area (pp. 21, 56–57) | Budget return fuel and bases; discoveries need army follow-through |
| Transport | Crossings and repeated reinforcement (pp. 21–22, 54–56) | Avoid offensive combat; withdraw after delivery and return with troops |
| Destroyer | Protect transports, threaten shipping, find submarines, scout (pp. 22–23) | Escort and anti-submarine coverage remain useful after exploration |
| Submarine | Powerful ship attack but weak defense (pp. 22, 57) | Evaluate interception and escort-screen roles; do not infer invulnerability |
| Cruiser | Shipping-lane protection and coastal bombardment (p. 23) | Suitable for route patrol and landing support, subject to threats |
| Carrier | Mobile fighter base (p. 23) | Needs useful aircraft, safe basing and coordination; hull alone adds little reconnaissance |
| Battleship | Attack shipping and bombard coastal armies (pp. 23–24) | Concentrated naval/shore support at substantial production delay |

Sentry and patrol are player orders, not combat bonuses. Sentry wakes on adjacent
enemy contact (p. 48). Patrol repeats between endpoints (p. 46). Escort follows a
ship, with the manual describing up to two spaces behind it (p. 39). Faster
escorts can outrun a convoy if used as its lead ship.

User-proposed coastal naval sentries and enemy-port interception fit these
capabilities, but the reviewed strategy section does not explicitly prescribe
blockades. Such a policy must use normal movement/combat and must not invent
production suppression. Do not block friendly loading/departure routes.

## Important qualifications

- Stationed units do not increase intrinsic city defense; all occupants perish
  when it is captured (p. 26). The manual advises sentry armies **near** rear
  cities (p. 56). Keeping a mobile army inside every city is our current allocation
  policy, not the same as establishing an effective interception screen.
- A conquering army becomes the permanent garrison and never returns to mobile
  duty (pp. 27, 51). Successful captures consume army supply without counting
  as combat losses in the original status report.
- Transport and carrier attack factors are halved. The tactical advice is to
  preserve them rather than initiate combat (p. 57); exceptions are not a blanket
  prohibition in the rules.
- The manual allows repeated fighter attacks within movement capacity (p. 57),
  and cruisers/battleships can use their two moves for two bombardments (p. 28).
  Our AI stops its tactical decision after an encounter; that is a strategy limit.
- Two or three transports refers to a full-scale hostile invasion, not every
  neutral island landing. Avoid imposing this threshold on inexpensive expansion.
- The manual suggests maintaining at least two transport-producing cities once
  the production base supports it (p. 55). Do not interpret that as a viable
  requirement for a player who owns only one city.

## Current gaps and experiment order

1. **Neutral expansion:** trace discovery, reachable objectives, troop availability,
   assault attempts and consumption of successful capturers. PR #19 fixes one
   scouting/guard conflict, not this entire chain.
2. **Transport logistics:** distinguish tiny neutral expeditions from hostile
   invasion groups; schedule rendezvous and reinforcement rather than merely
   raising ship counts.
3. **Naval duties:** distribute escorts, coastal sentries and corridor patrols;
   measure traffic protected/intercepted and reassignment after ownership changes.
4. **Air operations:** first verify fuel, patrol, sentry and home-base rules, then
   evaluate city-based fighters across varied map sizes and coastal access.

Compare identical generated seeds, swapped starts and longer campaigns. The
manual describes typical worlds with about 60–70 cities and map validation
constraints; our 12-city generated evaluations are stress samples, not
representative original-map coverage. Retain unusual maps, but label them.
