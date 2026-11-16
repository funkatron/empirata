# Q8 OODA plan — ALG-AI-001 standing route hooks (2026-11-16)

## Observe

- Classic executor handled reactive go-home (half HP) but not player-set **go-home** or **move-to**.
- `executeStandingOrders` runs at endTurn; computer pass should take **one** `routeStep` toward goals (ALG-013 pass limit 1).

## Orient

- Reuse `routeStep` toward move-to destination or nearest home city.
- Priority: damaged go-home > sentry > random > standing route > none bearing.

## Decide

PR `cursor/q8-alg-ai-001-standing-85b7` (stack on #134).

## Act

`npm test` → push → PR.