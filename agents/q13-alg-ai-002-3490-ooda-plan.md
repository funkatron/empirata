# Q13 OODA plan — full ALG-AI-002 `0x3490` (2026-11-16)

## Observe
- Q5/Q9 partial chooser: undefended army, transport/cap, fighter/carrier/destroyer branches.
- DOS table: coast counts, transport-adjacent gate, threat scouts, ship-mix downgrade loop, grade-B battleship/destroyer gates.

## Orient
- Still one `selectProduction` per city at computer turn end; no human prompts.
- Keep `classicLiveUnitCounts` as the `ES:1810` analogue.

## Decide
- Expand `chooseClassicCityProduction` with documented priority sketch + `classicShipMixProduction`.
- Add focused tests for mix downgrade and threat army branch.

## Act
- PR `cursor/q13-alg-ai-002-3490-85b7`.