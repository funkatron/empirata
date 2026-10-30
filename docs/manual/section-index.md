# Manual section index

Printed pages are the citation standard. PDF pages identify one-based spreads.
See the [reading record](source-record.md) for actual verification depth.

| Printed pages | PDF pages | Topic | Empirata entry point |
| --- | --- | --- | --- |
| 9–11 | 9–10 | Player selection, Standard/Expert, demonstration, PBM | `types.ts`, `scenario.ts`, `game.ts` |
| 12–14 | 11–12 | Production/combat efficiency; selecting existing MAP files | `units.ts`, `combat.ts`, `scenario.ts` |
| 15–18 | 12–14 | One starting city, production choice, coordinates and screen | `scenario.ts`, `src/ui/main.ts` |
| 19 | 14 | Private map memory, turn phases, expansion, surrender | `knowledge.ts`, `game.ts` |
| 20–21 | 15 | Symbols, army, fighter, transport | `units.ts`, `game.ts` |
| 22–23 | 16 | Transport capacity, submarine detection, warship roles | `units.ts`, `knowledge.ts`, `adjudication.ts` |
| 24–25 | 17 | Unit summary Table III, factories and movement | `units.ts`, `game.ts` |
| 26–27 | 18 | Stacking, damage, cargo, combat, repair and city garrison | `combat.ts`, `adjudication.ts`, `game.ts` |
| 28–29 | 19 | Bombardment; manual moves versus standing orders; Survey | `adjudication.ts`, `game.ts`, `src/ui/main.ts` |
| 30–35 | 20–22 | Modes, menus and command-availability matrices | `types.ts`, `src/ui/main.ts` |
| 36–37 | 23 | Activate, Clear Orders, combat replay, service record | `game.ts`, events |
| 38–39 | 24 | Display settings, escort geometry and speed mismatch | `setOrder`, `executeStandingOrders` |
| 40–41 | 25 | Flight Paths, Go Direction, Go Home, Go Random | `types.ts`, `setOrder`, `executeStandingOrders` |
| 42–43 | 26 | Group Survey, information, fighter photo-reconnaissance | `knowledge.ts`, `src/ui/main.ts` |
| 44–45 | 27 | Load Ship, automatic boarding, Move To | `fillShip`, `unloadShip`, `routeStep` |
| 46–47 | 28 | Move To fuel limit, Patrol To, production map | `setOrder`, `executeStandingOrders` |
| 48–49 | 29 | Sentry, production Table VII, switching and saturation | `setOrder`, `beginTurn`, `selectProduction` |
| 50–51 | 30 | Ship report, Skip Move, loss accounting | `src/ui/main.ts`, events |
| 52–53 | 31 | Unload Ship, Wait, observer View, known-world map | `unloadShip`, `src/ui/main.ts` |
| 54–55 | 32 | Opening production, neutral expansion, reconnaissance | `playRedOpponent`, scout planners |
| 56–57 | 33 | Reinforcement, combined invasion, rear defense, tactics | landing/mission planners; roadmap |
| 58–59 | 34 | Map design constraints and editor overview | evaluation generator; no historical editor parity |
| 60–61 | 35 | World growth, city editing, loading | future map editor |
| 62–63 | 36 | Sprinkle Cities, Validate Cities, saving | `scripts/campaign-maps.mjs` comparison |
| 64–67 | 37–38 | World View, credits and implementation history | historical context only |

Engine filenames refer to `src/engine/`. Function names are search anchors, not
claims that the corresponding historical feature is complete.
