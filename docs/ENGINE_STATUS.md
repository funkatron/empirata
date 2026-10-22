# Empirata engine status — v0.4

**Rules target:** Interstel *Empire: Wargame of the Century*, DOS 2.05, classic edition. All implementation work should use the same reference edition.

## Working systems

| System | Coverage and limitations |
|---|---|
| World | 100×60 grid, impassable border; original custom test terrain, not historical .MAP files |
| Units | All eight original classes, hit points, movement allowances, hit damage, production cost |
| Fog of war | Faction-specific memory and live visibility; unusual submarine and city observation cases remain provisional |
| Movement | Manual cardinal/diagonal moves and domain restrictions; some special stacking/boarding rules not implemented |
| Production | Normal 50% efficiency setup/repeat cycles; rounding and non-50 efficiencies not implemented |
| Combat | Real 50/50 hit-allocation at normal efficiency, continuing until one combatant dies; unit-specific damage and ship damage persistence |
| Conquest | A single 50% roll for a normal-efficiency army attacking a nonfriendly city; garrison/army loss consequences |
| Naval combat | Destroyer/submarine interaction, submarine triple damage, damage-based movement and cargo loss adjudication |
| Computer opponent | Close Quarters-only basic Red opponent chooses goals from **Red's PlayerView**, executes the same movement/combat rules; not original AI parity |
| Turns | Faction rotation, beginning-of-turn production and repair; exact DOS timing still needs verification |
| Browser | Canvas rendering, touchscreen + keyboard, touch panning, zoom, selection and city production |
| Saves | Seeded RNG state, faction knowledge, JSON export/import, browser autosave; schema 1 compatible with v0.3.1 saves |

## Combat evidence and remaining uncertainty

The 2.05 manual states each normal-efficiency combatant has an equal chance of dealing a hit; higher combat efficiency changes those odds proportionally. Hit strength is fixed by the unit. Army city conquest is a function of the attacking faction's combat efficiency; the normal setting is 50%. The manual also confirms a successful army becomes the city's defending garrison.

**Implemented probabilities match the manual at normal settings.** The exact Interstel DOS pseudo-random generator and its per-turn call order have not been recovered. Empirata uses a deterministic xorshift PRNG and records its seed/draw count in saves; exact byte-for-byte DOS replay is not claimed.

Source: [Interstel 2.05 manual](https://oldgamesdownload.com/manual/empire-wargame-of-the-century-dos-manual-english/) — *New Game Options / Combat Efficiency* and *Combat*, pp. 12 and 26–27.

## User interface policy

There are **no scripted victory/defeat buttons or demonstration scenarios which substitute hand-picked outcomes for gameplay**. Close Quarters uses normal attacks; the deterministic, externally supplied hit-sequence adjudication utility remains internal for engine **unit tests only**.

Close Quarters includes additional blue armies so players can engage in multiple attacks without losing all infantry on the first failed assault. The preliminary Red AI takes actions during **Next round**; the old `classic-lab` remains passive for regression tests.

## Follow-up work

1. Naval transport loading and unloading, fighter carriers and fuel/refueling.
2. Complete original standing orders (move-to, direction, patrol, escort, sentry waking), avoiding automatic attacks from orders.
3. Improve Red AI strategic behavior while preserving faction-specific knowledge.
4. Historical map loading/selection, production capture details and timing, city vision, full detection matrix.
5. Win/loss detection, multiple factions and game menus.
6. Behavioral comparison with licensed/authentic DOS version to resolve unresolved details.
