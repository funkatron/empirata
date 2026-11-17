# Q19 OODA — Classic offshore neutral/enemy sealift (v0.6.4)

## Observe
- v0.6.3 land `classicArmyConquestStep` only helps after cities are on the chart **and** army-reachable.
- Continents campaigns: dozens of charted neutrals, almost no captures without transports (user save r261).
- Modern stack has invasion routing; classic ALG-AI-001 had no sealift staging.

## Orient
- Knowledge-limited only (`PlayerView`); reuse `classicArmyReachableOnChart` / `classicRouteStep`.
- One activation per unit; disembark then assault on later ticks (DOS pass limit 1).
- No modern `aiObjective` fields on saves — stateless per-turn heuristics.

## Decide
- `classic-amphibious.ts`: offshore objectives, sea approach step, charted beach landing, empty transport → friendly coastal port.
- Executor: transport branch before random/none; inject `disembarkArmy`.
- Tests: two-island fixture + optional continents horizon smoke.

## Act
- Branch `cursor/q19-classic-amphibious-85b7` → PR → **0.6.4**.