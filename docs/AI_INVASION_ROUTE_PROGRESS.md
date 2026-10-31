# Invasion progress through coastal detours

## Problem

The stalled-mission deadline measured Chebyshev distance to the objective city.
A loaded transport could follow a useful sea route around a peninsula for more
than 24 rounds without ever improving that distance. It would then abandon a
mission despite getting closer to a usable landing approach.

## Change

Transport navigation and progress tracking share one route search. It finds the
shortest currently navigable sea approach to a safe, unoccupied beach with a
confirmed ground connection to the remembered objective. Decreasing remaining
sea steps, or unloading cargo, restarts the 24-round progress clock.

If no delivery route can be planned, retain the city-distance measure while the
existing coastal explorer searches for more information. Persist which measure
is in use and rebase the clock when it changes; sea steps and city distance must
not be compared as if they were the same quantity. Save import validates this
measure. Existing-save migration is intentionally out of scope.

The search uses faction intelligence, including current unit obstruction and
fresh threats. Its existing ability to propose a sea approach through unknown
terrain is unchanged; actual movement still checks ordinary terrain and rules.
A stationary ship still expires after 24 rounds, including when adjacent to a
usable beach but failing to unload. The 12-round objective cooldown remains.

## Verification checklist

- [x] A route around a long separate peninsula exceeds 24 moves and retains its
  objective while city distance grows. Every move shortens the delivery route.
- [x] Once that ship stops at its landing approach, the stall deadline expires.
- [x] Discovering a usable coast switches from city distance to sea distance,
  rebases the clock, survives save/reload, and still expires if motion stops.
- [x] Invalid persisted progress measures are rejected.
- [x] Existing timeout boundary, unloading, retry, inland capture and reboarding
  regressions pass.

## Limits

This corrects progress accounting, not objective scoring or invasion strength.
Route length is measured in sea steps rather than travel turns; damage remains
constant within this measure unless a new obstruction changes the route. Switching
between available/unavailable routes can restart the clock, so sustained traffic
or changing threats may postpone abandonment. Unknown-route exploration still
uses city distance, and target selection still prefers straight-line proximity.
The shared search adds a route computation per loaded ship's mission update;
no observer-speed improvement is claimed. Combined sea/ground delivery cost,
repeat-wave allocation, and city-only island handling remain separate work.

## Validation and campaign observations

265 engine tests and all four bundle checks pass. Engine coverage is 97.96% lines
and 94.23% branches. Six clean 150-round campaigns use the same layouts/seeds as
PR #31; all resulting saves validate. Values below are Blue / Red.

| Layout | Seed | Prior cities | Current cities | Prior landings | Current landings |
| --- | --- | --- | --- | --- | --- |
| continents | 17 | 5 / 2 | 5 / 2 | 0 / 0 | 0 / 0 |
| continents | 83 | 5 / 3 | 5 / 2 | 0 / 0 | 0 / 3 |
| islands | 17 | 1 / 2 | 1 / 2 | 0 / 0 | 0 / 3 |
| islands | 83 | 3 / 1 | 3 / 1 | 0 / 0 | 0 / 2 |
| archipelago | 17 | 1 / 1 | 1 / 1 | 2 / 0 | 2 / 0 |
| archipelago | 83 | 3 / 1 | 3 / 1 | 4 / 2 | 4 / 2 |

Additional landings do not establish a stronger campaign: Red loses a city in
one continent comparison, and several settings still barely use shipping. This
change fixes the demonstrated detour timeout; it does not resolve the general
army backlog or prove better conquest. [Raw results](evaluation/2026-10-31-route-progress.json).
