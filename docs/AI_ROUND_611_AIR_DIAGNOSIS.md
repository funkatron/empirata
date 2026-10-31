# Round-611 aircraft diagnosis

## Save evidence

All ten cities belong to Red. Blue's remaining airborne fighters are u168 at
(20,48), fuel 12, and u211 at (19,46), fuel 10. Neither has a friendly city
available. Red's remembered reports for both were observed on round 445 and are
stale on round 611. Its closest units are respectively eight and six squares away;
there is no immediate adjacent attack opportunity in this snapshot.

## Corrections

Previously fuel was charged by moves, launches and combat, but unused airborne
movement had no cost. An AI fighter with no useful move or reachable base could
therefore remain aloft forever. Settle its unused movement allowance as loiter
fuel when its owner ends the turn. Movement plus loitering consume a single
five-space turn budget. Skip settles that budget immediately so it cannot evade
fuel consumption; turn end does not double-charge it. Friendly-city and embarked
carrier fighters are exempt. Exhaustion removes the aircraft and logs a crash.

This timing is an explicit engine correction; exact original DOS skipped-move
scheduling still needs executable verification. The manual establishes limited
fighter fuel and basing restrictions, but our reviewed text does not establish
all idle-turn charge details. Do not describe that timing as DOS-verified.

Fighter reconnaissance now values checking stale contact areas even on fully
charted terrain. It retains the existing return-fuel constraint and prioritizes
getting home when fuel is low. It uses remembered locations as investigation
areas, not live target coordinates. Normal observation confirms or clears them.
No hidden enemy position is consulted. Fuel-safe air interception and broader
naval patrol assignment remain separate roadmap work.

## Verification

Focused checks cover stationary exhaustion, partial movement plus loitering,
Skip without duplicate charges, based exemptions, immutable inputs, save/replay,
stale-area reconnaissance and insufficient-fuel refusal.

Continuing the uploaded snapshot with ordinary turn transitions and no movement
charges Blue to 7/5 after its first completed turn, 2/crashed after the second,
and both crashed after the third. This is a diagnostic turn-transition check,
not a claim that a complete AI match was replayed. The uploaded save is not
modified or repaired.

## Stale transport areas

Destroyers, submarines, cruisers and battleships now investigate reachable stale
transport reports before discretionary terrain reconnaissance or coastal holding.
They first handle fresh transport targets and immediate adjacent threats. Route
to observation range of the remembered location, then use ordinary knowledge
updates to confirm or clear the report. Do not assume a ship still occupies that
square, initiate fabricated combat, or route through hidden water or hostile ports.
Four normal-turn regressions verify approach, no combat against an empty reported
square, report invalidation after observation and save/reload replay.

## Autonomous shipping check

The corrected fuel model changes fleet production timing. At round 101 in the
clean autonomous fixture, Red's first loaded transport had a newly assigned
mission (progress round 100), one army aboard, position (82,36) and two spent
movement. The old 100-round observation window recorded only its first loaded
position. Extend the bound to 150 rounds while retaining actual loaded sea
movement, production, boarding and cargo-integrity assertions for both factions.
This is an explicit timing-window change, not a reduced movement requirement.
The separate production-to-overseas-capture regression remains unchanged.
