# Consolidated AI strategy: capture and sustain cities

## Primary objective

Expand and retain the city production base. Reconnaissance, fleet combat and air
operations support army delivery and city capture. Building a fleet or revealing
the map is not itself evidence of strategic progress. Both factions use this
policy and their own private intelligence.

## Production priorities

1. Replace missing city defenders and preserve the agreed defensive allocation.
2. Finish useful committed production instead of discarding progress repeatedly.
3. At a supplied coastal factory, build missing transport capacity before assigning
   additional scouts, fighters or carriers.
4. Build reconnaissance/support units when delivery demand is supplied; keep
   factories producing armies otherwise. No strategic production pauses.

Transport demand scales with army supply. When a hostile city is known and at
least six armies exist, target at least two transports. With both hostile and
neutral objectives and at least twelve armies, target at least three. These are
provisional strategic demand rules, not caps: larger army pools continue to raise
transport demand. Other factories assigned transports count toward demand.

This preserves early destroyer reconnaissance before a local troop supply exists.
Inland factories cannot build ships. Local supply and normal production timing
still constrain when transports can actually finish.

## Parallel expansion and hostile invasions

- Preserve valid missions, route through known geography, and retry stalled
  objectives after the existing bounded cooldown.
- Hostile objectives can attract multiple transports. Existing nearby landing
  coordination assigns distinct beaches and a larger ready force.
- If three or more loaded transports share a hostile objective and no loaded
  expedition covers a known neutral city, a deterministic distant ship can take
  the neutral objective. Keep at least two assigned to the hostile city.
- Do not reassign ships within three squares of their hostile objective. Retain
  the resulting neutral assignment across turns rather than oscillating.
- Continue ordinary army production and repeat transport supply trips. A successful
  capturing army becomes the city garrison, so expansion consumes mobile supply.

The neutral diversion uses remembered ownership and objective assignments. It is
not a proof of route feasibility; route planning and mission timeout remain
responsible for inaccessible objectives. The fleet needs enough loaded ships to
preserve both efforts. A two-transport invasion is not forcibly split.

## Supporting roles

Destroyers reveal useful coast, engage fresh enemy shipping and protect delivery.
Fighters scout with return fuel reserved. Carrier production and flight operations
must not replace transport/army logistics. Coastal sentries, port interception and
patrols should be measured by defended departures, useful intelligence and traffic
intercepted, rather than movement alone.

## Remaining coordination work

Nearby landing waves already exist; distant convoy rendezvous, arrival scheduling,
full-strength recruitment and repeat reinforcement groups remain incomplete.
The current policy can retain two invasion transports, but does not guarantee two
full loads or synchronized arrival. Implement explicit expedition phases and
bounded wait/reassignment from the technical plan before claiming that behavior.

## Verification and evaluation

Regression checks cover transport-before-scout selection, multi-transport hostile
assignments, neutral diversion without breaking a two-ship force, landing-area
mission stability and existing coordinated landing-wave behavior. Continue paired
clean generated campaigns, including swapped starts and varied city density.
Measure production-to-loading delay, capture attempts, objective age, successful
captures, beachhead losses and reinforcement deliveries. Do not tune solely to
constructed invasion fixtures.

See [technical implementation plan](TECHNICAL_IMPLEMENTATION_PLAN.md),
[manual strategy](manual/strategy.md), and [air operations](AI_AIR_OPERATIONS.md).

The initial three clean 100-round seed-17 layout checks completed and passed save
validation. Final Blue/Red cities were continents 4/2, islands 1/2 and archipelago
1/1, unchanged from the preceding air-production sample. This is not evidence of
a general conquest improvement. [Raw observations](evaluation/2026-10-30-capture-priority.json).

## Bounded invasion assembly

Hostile expeditions with an actual loaded partner may wait for recruitment beside
an army-producing friendly city, or hold within six squares of the objective
while a loaded partner remains outside the nearby group. The first wait round
is saved per objective. After twelve rounds the wait expires permanently for
that objective; mission changes clear it. Partners catching up, completed loading
or loss of the partner releases the wait early. Fresh nearby army threats prevent
holding at an unsafe station. Neutral and isolated expeditions do not use this
assembly wait.

Waiting ships do not move or perform opportunistic reconnaissance drops, and are
excluded from the landing wave until released. Existing loading still runs so a
waiting ship can collect available reinforcements. Other ships continue moving.
Hostile landing readiness now prefers six troops per nearby transport, capped by
actual available cargo/support and safe beach capacity. A broad beach can receive
a full twelve-army wave from two transports; spent troops delay that wave. Narrow
beaches retain the existing capacity bound rather than waiting for impossible
space.

Rendezvous now saves a shared staging coordinate near the leading ship once it
reaches the six-square approach zone. Each loaded partner receives a distinct
available station around that coordinate. Known-water breadth-first routes supply
movement steps and arrival estimates, including damage-reduced speed and movement
already spent. If no station/route exists, or the group cannot arrive before the
remaining deadline, release the assembly attempt. A gathered marker prevents an
assembled convoy from reversing to an old staging point.

This coordinates the approach; it is not a global campaign scheduler. It does not
guarantee full recruitment within twelve rounds, simultaneous arrival on a single
turn, or recovery of a shared staging area occupied by newly discovered enemies.
Estimates are recomputed from current knowledge. Repeated reinforcement planning
remains follow-up work. The limit is shorter than the existing no-progress mission
timeout, so assembly alone does not consume the full retry window.

Final assembly-policy smoke evaluation: three clean 100-round seed-17 generated
layouts completed with normal save validation. Final Blue/Red city holdings were
4/2, 1/2 and 1/1, unchanged from the previous sample. These sparse early campaigns
are not sufficient to establish coordinated invasion effectiveness; the full-wave
fixture verifies the interaction explicitly. [Raw results](evaluation/2026-10-30-invasion-assembly.json).

The convoy-staging change also completed three clean 100-round seed-17 layout
checks with normal save validation. Holdings remained 4/2, 1/2 and 1/1 Blue/Red.
This smoke sample does not prove a campaign advantage or exercise every large
convoy case; focused regressions cover damage-sensitive arrival estimates,
unknown/disconnected routes, deadline feasibility and gathered-state behavior.
[Raw staging observations](evaluation/2026-10-30-convoy-staging.json).
