# Initial AI aircraft production and reconnaissance

The production planner can now choose fighters and carriers, using normal factory
progress and shared faction-known geography. Blue and Red use the same policy.
This is modern experimental strategy, not a reconstruction of DOS AI.

## Production decisions

- Missing city defenders still require armies first.
- A fighter requires at least three locally connected armies, unsatisfied aircraft
  demand, and a useful fuel-feasible scouting route from the factory. Army supply
  for existing transport capacity takes priority over a new fighter assignment.
- Fighter demand starts at one per two cities (rounded up, minimum one) plus four
  per existing carrier. Other factories assigned fighters count toward demand.
- A coastal carrier requires local army supply, an existing transport, a destroyer
  and at least two fighters. Carrier demand scales at one per two transports,
  rounded up. Already assigned factories count toward demand.
- Preserve committed aircraft/carrier progress while demand remains; routine troop
  boarding must not reset a partially completed carrier. Production stays active.

These are provisional demand heuristics, not unit caps or guaranteed optimal build
orders. The completion regressions run the AI on every production turn and verify
actual fighter/carrier creation, not merely a selected production label.

## Reconnaissance and fuel

`planAiFighterStep` reads only PlayerView. It searches air routes around known
occupied cells and nonfriendly cities, calculates return routes to owned cities
and carriers, and favors adjacent unknown terrain per travel cost. Outbound
reconnaissance retains a two-move return margin; near the reserve boundary it
returns to a friendly base. Each decision searches at most the fixed world grid.

Hidden contacts may invalidate a route. Future loss or movement of a base cannot
be guaranteed against by the current snapshot. If no feasible step exists the
fighter holds; active interception and no-safe-base recovery remain follow-ups.
Fighters do not use the generic wandering fallback.

## Carrier scope

Carriers hold as refueling stations. Ready embarked fighters automatically launch
when the faction-view reconnaissance planner finds a useful fuel-feasible route.
They use ordinary movement to return, board and refuel; a later AI turn can launch
another sortie. The launch consumes normal fighter movement and fuel. Each launch
is checked against current authoritative state, so a newly encountered obstacle
can interrupt it without granting movement or bypassing combat rules.

Full carriers are excluded as return bases for airborne fighters. A fighter already
aboard may launch from a full carrier because its own departure frees a slot.
No useful frontier or no remaining movement means the fighter stays aboard.

Mobile carrier groups, carrier-relative player patrol routes and active air
interception remain on the technical implementation plan. Base movement/loss and
capacity changes after a planning snapshot can still invalidate a return route;
this is not a guarantee of survival under future enemy actions.

## Verification

Tests cover both production choices through normal completion, completion while
supply armies board transports, replay, fuel-driven return and defender priority.
A separate 20-turn regression checks launch, carrier recovery/refueling and a
subsequent sortie with save/reload every turn. Full/lost bases and holding are
covered separately.
Generated-map campaigns supplement constructed fixtures; they are observations,
not a general claim of stronger play. Monitor computation cost and aircraft loss
rates in longer campaigns before tuning demand upward.

A 100-round clean-start check on seed 17 completed for continents, islands and
archipelago, with final Blue/Red city holdings 4/2, 1/2 and 1/1 respectively.
All final saves passed normal export/import validation. These three observations
are not a win-rate or comparative improvement estimate; carrier completion is
established by the explicit production-cycle regression. The current campaign
report does not enumerate aircraft classes. [Raw campaign results](evaluation/2026-10-30-air-production.json).
