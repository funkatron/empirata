# Modern AI experimental fields on `Unit`

These optional properties persist in JSON saves (`schema: 1`) and affect **Modern (experimental)** opponent behavior only. Classic DOS policy must not depend on them. Do not relocate them to a separate `AiUnitState` map without explicit project approval.

Validation rules below mirror `importSave` in `src/engine/save.ts`. Writers are in `src/engine/ai/modern-planners.ts` and `src/engine/ai/modern-executor.ts`.

## `aiObjective` (transport)

| | |
|---|---|
| **Type** | `string` — hostile or neutral **city id** the transport is invading |
| **Set/cleared** | `updateAiTransportMission` (planner) applied in executor post-production pass |
| **Semantics** | City mission survives moves/turns until capture, unload, stall timeout, or avoid list |
| **Save** | Required on transports only; must reference an existing city id |

## `aiMissionProgress` (transport, requires `aiObjective`)

| | |
|---|---|
| **Type** | `{ round, bestDistance, metric: 'sea' \| 'city', cargo }` |
| **Purpose** | Detect stalled invasion (no progress over 12 rounds) |
| **Clear** | Cleared with `aiObjective` when mission ends or stalls |
| **Save** | Requires concurrent `aiObjective`; round ≤ game round; non-negative distances/cargo |

## `aiAvoidObjective` (transport)

| | |
|---|---|
| **Type** | `{ id: cityId, until: roundNumber }` |
| **Purpose** | Temporary ban on retrying a stalled objective (12-round cooldown) |
| **Clear** | Removed when `until <= currentRound` in mission update |
| **Save** | City id must exist; `until >= 1` |

## `aiPickup` (transport)

| | |
|---|---|
| **Type** | `{ armies: string[], startedRound: number }` |
| **Purpose** | Beach pickup choreography — which army ids must meet the ship |
| **Timeout** | Planner ignores pickup after 12 rounds from `startedRound` |
| **Save** | Non-empty unique army id list; `startedRound` within game round |

## `aiAssembly` (transport)

| | |
|---|---|
| **Type** | `{ objective, startedRound, staging?: Coord, gathered?: boolean }` |
| **Purpose** | Convoy wait at staging until partner transports load armies (max 12 rounds) |
| **Save** | `objective` is city id; optional `staging` is valid map coord |

## `aiBeachhead` (army)

| | |
|---|---|
| **Type** | `string` — city id copied from transport `aiObjective` on landing |
| **Purpose** | Keeps assault troops from being re-embarked at friendly supply ports |
| **Save** | Armies only; city id must exist |

## Replay and human players

Human-directed units may carry these fields if a save originated from an AI game, but the UI does not edit them. Loading an invalid combination throws from `importSave` (see error messages in `save.ts`).

## Related docs

- [ROADMAP.md](ROADMAP.md) P2 item 6
- [agents/p2-ooda-plan.md](../agents/p2-ooda-plan.md)
- Type definitions: `src/engine/types.ts`