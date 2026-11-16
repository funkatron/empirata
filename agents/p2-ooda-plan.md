# P2 OODA plan (2026-11-15)

Roadmap: [P2 — Remove misleading behavior and clarify model ownership](../docs/ROADMAP.md#p2-remove-misleading-behavior-and-clarify-model-ownership) (items 5–6).

## Observe (facts)

| Area | Current state | Evidence |
|------|----------------|----------|
| **Embarked `moveUnit`** | Rejects with plain `Error`, not `RuleNotImplemented`; message points to `disembarkArmy` / `launchFighter`. | `src/engine/game.ts` L250–252; `tests/embarked-move-guidance.test.mjs` |
| **`RuleNotImplemented('CARGO')`** | Only when a **non-embarked** mover enters a cell with another **friendly** unit and **no city** (same-square stacking / unverified load path). | `src/engine/game.ts` L284; no dedicated regression today |
| **Legal cargo APIs** | `embarkArmy`, `disembarkArmy`, `boardFighter`, `launchFighter`, `fillShip`, `loadShip`, `unloadShip` exist; UI calls `moveUnit` on map clicks. | `src/ui/main.ts`, `src/engine/game.ts` |
| **`ai*` on `Unit`** | Six optional fields on `Unit`; short inline comments in `types.ts`; strict `importSave` validation in `save.ts`. | `src/engine/types.ts`, `src/engine/save.ts` L64–83 |
| **`ai*` writers** | Modern AI only: `modern-planners.ts` (mission state) + `modern-executor.ts` (persistence onto live units). | grep `aiObjective` under `src/engine/ai/` |
| **Docs gap** | Roadmap item 6; fragment in `docs/TECHNICAL_IMPLEMENTATION_PLAN.md`; no single schema/intent doc. | `docs/ROADMAP.md` |
| **Process** | P0–P1 closed on `main`; one ALG/behavior change per PR; gameplay vs docs commits separated per roadmap. | `AGENTS.md`, `docs/ROADMAP.md` |

## Orient (constraints and interpretation)

1. **Roadmap item 5 wording is partly stale.** Embarked-unit guidance is already correct; remaining risk is **misleading `CARGO` code** and **UI/autopilot** still routing users through `moveUnit` into that branch.
2. **Do not invent stacking rules.** Same-cell friendly stacking must either match verified Interstel mechanics (after `docs/` review) or stay blocked with an **accurate** error—not a generic “unfinished rule” if the real issue is stacking.
3. **Item 6 is documentation + contract clarity, not a schema migration.** No `AiUnitState` side map without explicit owner approval.
4. **Modern AI is frozen strategically** but these fields are part of save/replay integrity; docs must match `importSave` validators.
5. **Verification policy:** minimal seeded fixtures; `npm run build` + `npm test`; separate PRs for engine vs docs.

## Decide (scope and sequence)

| PR | Goal | Out of scope |
|----|------|----------------|
| **P2a — Cargo rule surface** (#TBD) | Reproduce `CARGO` trigger; read manual notes; replace `RuleNotImplemented` with precise `Error` **or** route to legal API if rules allow; add `tests/p2-cargo-rule-surface.test.mjs`; audit UI/autopilot for embarked moves (should already hit legal APIs). | Full ALG cargo/stacking implementation without DOS evidence |
| **P2b — `ai*` documentation** (#TBD) | Add `docs/MODERN_AI_UNIT_FIELDS.md` (or `agents/`) table: field, unit kinds, semantics, writers, save validation, replay notes; cross-link from `types.ts` comments + roadmap. | Moving fields off `Unit`; classic AI using these fields |

**Order:** P2a first if it touches player-facing errors; P2b can parallelize as docs-only once P2a scope is frozen (no file conflict).

**Success criteria**

- P2a: No `RuleNotImplemented('CARGO')` on paths that have legal APIs; regression covers the actual trigger; 430+ tests green.
- P2b: A reader can determine save/load behavior for each `ai*` field without reading planner source; `importSave` rules cited in doc.

## Act (next steps)

1. **P2a — Observe in runtime:** construct lab fixture: two friendly armies same cell → `moveUnit` → capture throw type/message.
2. **P2a — Orient:** skim `docs/manual/` and existing stacking tests (`ai-transport-interception` canal stacking) for allowed co-location.
3. **P2a — Decide:** choose “accurate error” vs small legal routing; update roadmap item 5 text if embarked path is explicitly **done**.
4. **P2a — Implement:** branch `cursor/p2-cargo-surface-85b7`, one commit + test, PR.
5. **P2b — Draft doc** from `save.ts` validators + planner/executor mutation sites; branch `cursor/p2-ai-fields-doc-85b7`, PR (no `src/` behavior change).
6. **Close P2** in `docs/ROADMAP.md` Current status when both PRs merge.

## OODA reuse

For non-trivial work (multi-file engine, roadmap queue items, AI/DOS parity), agents should write or refresh an OODA section **before coding**: Observe (facts + file pointers), Orient (rules/constraints), Decide (PR boundaries), Act (ordered steps). See `AGENTS.md` — **Planning (OODA)**.