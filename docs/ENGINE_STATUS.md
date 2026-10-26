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
2. Validate the original stopping/waking semantics of implemented standing orders, and compare against DOS traces; automatic attacks remain disabled.
3. Improve Red AI strategic behavior while preserving faction-specific knowledge.
4. Historical map loading/selection, production capture details and timing, city vision, full detection matrix.
5. Win/loss detection, multiple factions and game menus.
6. Behavioral comparison with licensed/authentic DOS version to resolve unresolved details.


## 2026-10-24 movement milestone

- Added **Go Home**: select a known, owned city and move toward it using remembered terrain. Stop when docked/arrived, at an obstruction, or when no safe route exists.
- Added **Escort**: follow a selected friendly unit; do not enter the leader's square or initiate combat. Lost targets clear the order.
- Browser unit controls expose both orders; save-file imports validate Escort targets.
- Covered home arrival, multi-round travel, occupied friendly cities, escort following, invalid/lost targets and persistence with lightweight Node tests.
- Historical details of Go Home destination preference and Escort formation remain *provisional* pending an original-DOS behavior trace.
- GitHub Actions compilation and Pages publication for this milestone must be verified separately; a source commit alone does not prove deployment.

## 2026-10-25 amphibious logistics milestone (initial)

- Army embarkation: move an army onto an adjacent friendly troop transport, subject to remaining movement and damage-adjusted capacity.
- Embarked army coordinates now follow the transport while sailing; the army remains inaccessible to direct attacks.
- Army landing: select an embarked army and move to adjacent legal land (or a friendly city) with movement available. Hostile-city assaults remain manual.
- Transport entering a friendly port unloads embarked armies automatically; overloaded damaged transports may not sail until unloaded.
- Close Quarters includes an adjacent friendly army and troop transport for hands-on testing.
- New small Node tests check boarding, cargo movement, unloading, capacity, invalid landing, persistence, and dock unloading.
- CI workflow now runs engine tests and regenerates the standalone `index.html` on successful main-branch builds.
- Still pending: original Load Ship/Unload Ship standing orders, fighter carriers, combat damage overflow, and definitive original-DOS cargo timing. Rules outside manual-confirmed cases remain provisional.
- Source changes are committed; verify GitHub Actions and the updated hosted site before claiming a successful deployment.

## 2026-10-25 aircraft carrier and cargo-combat milestone

- A fighter may move onto an adjacent friendly carrier or board using `boardFighter`. Refueling aboard the carrier is enabled; exact original tick timing remains provisional.
- Embarked fighters follow the ship. Select one from the carrier cargo list, then tap a free adjacent square to launch via `launchFighter`.
- Friendly-port arrival unloads and refuels aircraft. The ship cannot move while overloaded.
- Destroyed ships destroy their embarked cargo. A surviving damaged carrier immediately loses aircraft beyond the reduced capacity. Which aircraft are removed first is deterministic but not yet DOS-verified.
- Close Quarters now includes a transport/army pair and a carrier/fighter pair for player testing.
- Seven carrier tests and two cargo-combat tests were added using the lightweight Node runner.
- Source and test changes are committed, but a passing end-to-end CI run and generated GitHub Pages bundle have **not** been independently confirmed.

## 2026-10-25 Load Ship, Unload Ship and invasion regression

- **Load Ship** now takes eligible adjacent friendly armies/fighters aboard a transport/carrier (including sentry units), waits for further cargo, and wakes automatically at damage-adjusted capacity. Ships with an active loading order cannot leave until it is cleared or loading finishes.
- **Unload Ship** wakes embarked units without automatically moving them ashore or restoring spent movement; players must launch/land individual units legally.
- Friendly ships leaving a friendly port automatically embark eligible units already in that city up to capacity.
- The browser unit panel exposes Load Ship / Unload Ship controls for transports and carriers.
- Small regression cases cover waiting loaders, reaching capacity, waking through manual boarding, harbor departures, save roundtrips and an end-to-end deterministic amphibious invasion followed by a city capture.
- The GitHub Actions workflow now also runs `node --test smoke/bundle.mjs` after generating the standalone HTML, guarding against broken embedded scripts without launching a browser.
- Historical uncertainties: exact selection order of cargo when several units are eligible, precise Load Ship wakeup timing, and original naval/cargo loss draw ordering still need DOS reference checks done *outside* normal CI.

## 2026-10-26 computer-opponent iteration

- Close Quarters Red opponent now **chooses city production** from its owned cities: normally armies, switching to a transport once it has at least three armies and no transport, then back to armies after a transport exists.
- Red **boards adjacent armies onto its own transports** using the same load rules as the player, and **lands embarked armies** on legal shores near cities actually known to Red.
- Loaded Red transports avoid immediately re-entering known friendly cities during routine movement. When known non-red cities are available, loaded transports use those locations as strategic movement goals.
- Decisions are deterministic and use the Red faction's `PlayerView` for knowledge-limited objectives; regression cases check that moving a completely invisible enemy does not change the decision state.
- This is *provisional strategy*, not reconstructed original Interstel AI. Tactical movement remains primitive; sea navigation, ship construction time and coordinated amphibious operations are important follow-ups.
- All new AI tests are designed to be fast, in-memory Node tests without an emulator. Source commits do not themselves establish a passing GitHub Actions run; check the workflow and generated bundle.
