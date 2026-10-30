# Empirata — Classic Rules Specification v0.1

**Project:** Empirata  
**Document status:** Research-backed implementation specification; open verification issues remain  
**Prepared:** 2026-10-21  
**Target ruleset:** *Empire: Wargame of the Century*, Interstel IBM PC/DOS **version 2.05**, documented in the *Star Fleet Planetary Task Force Command Manual*, second printing August 1988.  
**Design mandate:** Strict classic gameplay; modern browser presentation and input only.

> **Scope warning:** The earlier Walter Bright **Empire version 5.0** manual is **not** the Interstel **version 2.05** manual. Do not import version 5.0 rules or *Empire Deluxe* mechanics unless independently corroborated in Interstel v2.05.

## 0. Conventions and evidentiary standard

- **[M] Manual-confirmed**: Explicitly supported by the Interstel v2.05 IBM PC manual (source [S1], relevant pages identified below).
- **[C] Corroborated**: Supported by the manual and independent v2.05 release notes ([S2]).
- **[I] Implementation requirement**: Internal engineering choice that preserves confirmed game behavior; not asserted to be original code design.
- **[?] Unresolved**: Requires inspection of an original executable, source code if legally available, or reliable additional documentation. No guessed behavior may silently become an authoritative rule.
- **[N] Non-rule presentation**: Browser/UI improvement permitted only if it does not alter game state, timing, information, or probability.

The manual occasionally describes outcomes but not exact algorithms. Where that occurs, this specification records the behavior and leaves algorithmic equivalence open. This is intentionally **v0.1**, not a claim that the Interstel executable has been reverse-engineered.

## 1. Game identity and scope

**IMP-001 [M]** A game is a turn-based struggle among **two or three** factions, each human-controlled or computer-controlled. Computer-only demonstration games are also supported in the original. The normal initial implementation target is one human versus one computer, but no rule may preclude three-player games. (Manual pp. 9–12.)

**IMP-002 [M]** Each faction begins with **one owned city** and chooses its initial production before beginning play. Other cities begin neutral unless assigned by game setup. (pp. 15–16.)

**IMP-003 [M]** The objective is strategic conquest: weaken and ultimately defeat all opposing players. The last computer opponent may offer surrender when it judges that it cannot win; the human may accept or refuse. Exact surrender threshold is unresolved. (pp. 19–20.)

**IMP-004 [M]** No research tree, technology upgrades, money, ore, food, diplomacy, infrastructure construction, terrain movement-cost system, or real-time combat is part of this baseline. The economy is city production of military units. (pp. 20–28.)

## 2. World and geometry

**IMP-010 [M]** Map dimensions are **60 rows × 100 columns**, zero-indexed from `(0,0)` in the upper-left. The outermost rows and columns are impassable, leaving **58 × 98 = 5,684** accessible map squares. (pp. 16–17, 58.)

**IMP-011 [M]** Square cells have eight compass-direction neighbors (orthogonal and diagonal). Units generally consume movement by moving one adjacent square per move. No hex grid. (p. 25.)

**IMP-012 [M]** Underlying geography distinguishes **land**, **sea**, and **city** cells. A city also has owner, production selection, production progress, and possibly occupants. A city on an accessible coast acts as a port. (pp. 20–25.)

**IMP-013 [M]** A normal new game offers selection of a `.MAP` file or random selection **from existing `.MAP` files**. It does **not** silently generate a fresh random world every time. The editor can generate new maps separately. (pp. 14–15, 44, 58–64.)

**IMP-014 [M]** Ordinary maps have approximately **60–70 cities**, depending on the terrain. This is a descriptive norm, not a mandatory global city count for custom maps. (p. 14.)

**IMP-015 [M]** The original map editor permits editing land, sea, and cities; creating or growing land/sea masses; scattering cities; and validating worlds. These are historical features, but do not need to be in the first playable build if known `.MAP` equivalents can be used. (pp. 58–64.)

**IMP-016 [C]** Interstel v2.05 contains coastline-rendering changes; ships cannot enter coastal **land** squares, only sea or permissible city squares. Armies may cross small depicted water gaps when traveling directly between adjacent passable land/coastal squares. The underlying movement is based on grid cell type, not decorative coastal pixels. (v2.05 release notes [S2].)

**IMP-017 [?]** Exact `.MAP` file format, random file-selection algorithm, terrain generation algorithm, and start-city placement rules need executable/data-file verification. Do not conflate map creation with map selection.

## 3. Turn sequencing and orders

**IMP-020 [M]** Each player's turn comprises **production, then movement/combat**. Players take sequential turns; normally player 1, then player 2, then player 3. (p. 19.)

**IMP-021 [M]** A faction turn is complete after each eligible unit has executed standing orders or has been offered an opportunity to move. The UI should ordinarily request input only for units needing orders or manual intervention. (pp. 19, 25, 28.)

**IMP-022 [M]** Available movement per faction turn is determined by unit type and current damage. Units execute up to their movement capacity. Automated orders persist between turns. (pp. 20–27.)

**IMP-023 [M]** Standing orders attempt to avoid routine obstacles, but units must interrupt and ask the player for direction when blocked or encountering relevant enemy proximity. **Standing orders must never autonomously initiate an attack against an enemy unit.** Direct manual movement into an enemy starts combat. (pp. 25, 28.)

**IMP-024 [M]** `Wait` postpones selecting an order until the other eligible units have been prompted during the current turn. `Skip Move` ends the selected unit's participation for this turn. `Sentry` persists across turns until awakened or cleared. (pp. 48, 50, 52.)

**IMP-025 [C]** v2.05's activation command allows a friendly unit that still has movement this turn to be selected directly, clears its existing orders, and returns to Move mode with that unit active. Units on sentry duty or aboard transports retain their ability to move in the turn under v2.05 turn sequencing. (p. 36; [S2].)

**IMP-026 [?]** Exact iteration ordering of units, movement after production, interrupt ordering, and legacy pass-through special cases must be verified against the DOS executable. Record event order in deterministic tests before declaring parity.

## 4. Units: canonical constants at standard efficiency

Values below are transcribed from the Interstel manual pp. 20–25, especially its unit summary and production descriptions. **HP** denotes damage required to destroy the unit, not an additional resource.

| Unit | Move/turn | HP | Damage per successful hit | First production turns | Repeat turns | Special |
|---|---:|---:|---:|---:|---:|---|
| Army | 1 | 1 | 1 | 6 | 5 | Captures cities; land only |
| Fighter | 5 | 1 | 1 | 12 | 10 | Fuel 20; land and sea flight |
| Destroyer | 3 | 3 | 1 | 24 | 20 | Detects enemy submarines |
| Troop transport | 2 | 3 | 1 | 30 | 25 | Carries up to 6 armies |
| Submarine | 2 | 2 | 3 | 24 | 20 | Stealth against most classes |
| Cruiser | 2 | 8 | 2 | 35 | 30 | Coastal bombardment |
| Aircraft carrier | 2 | 8 | 1 | 48 | 40 | Carries/refuels up to 8 fighters |
| Battleship | 2 | 12 | 3 | 60 | 50 | Coastal bombardment |

**IMP-030 [M]** The standard combat efficiency is **50%**. Most units have attack and defense multipliers of 1. Exceptions described by the manual: troop transport attack **½**, defense **½**; submarine defense **½**; aircraft carrier attack **½**; army defense **½ when under naval bombardment**. Their exact placement in an attack/defend sequence still needs verification. (pp. 19–24, 26.)

**IMP-031 [M]** Army: land movement, one space per turn, can attack other armies and many ships when legal, and **only armies can capture cities**. Can board troop transports. Cannot detect or attack submarines. (pp. 20, 26–28.)

**IMP-032 [M]** Fighter: five spaces per turn and **20 movement spaces maximum fuel** between refueling at a friendly city or own carrier. It crashes if fuel is exhausted while airborne. It cannot detect adjacent enemy submarines, but may attack one on entering its cell. (pp. 20–21.)

**IMP-033 [M]** Destroyer: three spaces per turn; detects enemy submarines; **cannot attack armies**. (pp. 21–22.)

**IMP-034 [M]** Troop transport: two spaces per turn; carries six armies when undamaged; each damage point reduces capacity by **two armies**. If overloaded after damage, excess cargo is destroyed when the transport next attempts to move unless unloaded first. Cannot attack armies; cannot detect adjacent enemy submarines. (pp. 21–22, 26.)

**IMP-035 [M]** Submarine: two spaces per turn; cannot see or attack armies and cannot see adjacent fighters. Its three damage per hit applies when striking ships. **Cities can detect adjacent submarines**; this sentence was visually confirmed on printed p. 22 on 2026-10-30, resolving the earlier OCR ambiguity. Destroyers and cruisers also detect submarines. The current engine omits city detection; see [MF-01](manual/findings.md). (pp. 22–24, 26.)

**IMP-036 [M]** Cruiser: two spaces per turn; eight damage to sink; two damage per hit; can detect/attack submarines and can bombard adjacent armies on land. (pp. 22–24, 28.)

**IMP-037 [M]** Carrier: two spaces per turn; up to eight fighters; damage reduces capacity one fighter per damage point and excess fighters over capacity are immediately destroyed after the hit. Refuels fighters. Cannot detect adjacent submarines or attack armies. (pp. 23–24.)

**IMP-038 [M]** Battleship: two spaces per turn; twelve damage to sink; three damage per hit; cannot detect adjacent submarines; may bombard coastal armies. (pp. 23–24, 28.)

**IMP-039 [?]** Maintain a formal target-permission/detection matrix, and verify corner cases including fighters contacting hidden subs, armies striking coastal ships, and how units stacked in cities enter combat. Do not infer an attack is legal solely from visibility.

## 5. Production and cities

**IMP-040 [M]** All combat units are made by owned cities. A city produces **one selected type repeatedly** until reconfigured. (pp. 25, 48–49.)

**IMP-041 [M]** Inland cities may construct **armies or fighters only**. Coastal cities/ports may construct those plus ships. (p. 25.)

**IMP-042 [M]** First production after selecting a type takes the **First** number of turns in the unit table, reflecting factory setup. Continued production of the same type takes the **Repeat** value. (pp. 20–25, 49.)

**IMP-043 [M]** Changing a city to a different production type **discards partially completed production**. (p. 49.)

**IMP-044 [M]** Per-faction **production efficiency** modifies production time: standard 50%; 100% produces at twice normal rate; 25% at half normal rate. The original offers adjustable efficiency ratings, but rounding of nondivisible times needs verification. (p. 12.)

**IMP-045 [M]** Each turn reports completed production, with option to change a newly completed city's production immediately. Notification of new armies/fighters can be disabled in the original. Ships can receive user-specified names of up to 16 characters; armies and fighters have automatically generated designations. (pp. 25, 39, 48–49.)

**IMP-046 [M]** The original has an **Over Population** saturation condition that stops city production while too many units exist. The exact global limit and count methodology are unresolved. (p. 49.)

**IMP-047 [M]** Only an army captures a neutral/enemy city. On a successful capture, the capturing army is **permanently dispersed into a garrison**, no longer remains a movable piece, and counts as a captured city rather than an army lost in combat. Units stationed in a city do **not** strengthen its intrinsic defense and are destroyed if enemy capture succeeds. (pp. 26–28, 50.)

**IMP-048 [?]** Precise city-capture probability, city combat efficiency interaction, captured-city production reset/progress behavior, and city ownership state after repeated failed attacks need direct validation.

## 6. Combat, damage, repair

**IMP-050 [M]** Combat is initiated by a manually ordered move onto an enemy unit's square, subject to legal attack restrictions. The exchange continues until exactly one combatant survives. Damage persists on ships. (pp. 26–27.)

**IMP-051 [M]** A player's combat efficiency is described as the probability of hitting; attacker and defender unit factors modify effectiveness, without changing damage inflicted per hit. **Do not substitute a guessed attack-roll sequence** for the unknown exact historical combat loop. (pp. 12, 19–20, 26.)

**IMP-052 [M]** Ships with damage **at least half of their maximum HP** have speed reduced to **one cell per turn** (when not destroyed). A ship repairs **one damage point per turn** while docked in a friendly **coastal** city. Docking unloads carried units automatically. (pp. 26–27.)

**IMP-053 [M]** A cruiser/battleship may bombard an **adjacent coastal army** while remaining at sea or in a friendly city. Bombardment expends **one movement space** and does not move the ship onto land. Two-move ships can perform two bombardments or combine one move and one bombardment in a turn, subject to actual remaining movement. (p. 28.)

**IMP-054 [M]** If a ship is destroyed, all aboard are lost. Damage to a loaded ship may reduce its capacity even when it survives. (pp. 21–24, 26.)

**IMP-055 [?]** Exact combat roll order, attack-vs-defense factors, mutual-hit resolution, encounter movement consumption, whether retreat exists (not described), and which state transition consumes which action require executable validation.

## 7. Transport, aircraft, and special actions

**IMP-060 [M]** An army enters a troop transport by moving onto it where legal; a fighter enters a carrier similarly. Normal square occupancy is one unit, with exceptions for city occupants and embarked units. Cities can contain multiple friendly units. (pp. 20–21, 26.)

**IMP-061 [M]** `Load Ship` places a transport/carrier on sentry until capacity is filled and then wakes it. A loading transport boards adjacent armies, including nearby armies on sentry. Leaving a friendly port automatically takes aboard eligible occupants to capacity. (pp. 43–44.)

**IMP-062 [M]** `Unload Ship` wakes onboard armies/fighters so they can receive orders. This is not identical to magically moving all cargo ashore. Units may need legal individual movement. (pp. 44, 52.)

**IMP-063 [M]** Fighters on carriers and in friendly cities are refueled according to the game's original behavior. `Go Home` sends ships toward friendly ports and fighters toward reachable friendly cities/carriers; the moving-carrier target is not guaranteed safe. (pp. 20–21, 40–41.)

**IMP-064 [M]** `Flight Paths` are persistent orders assigned **from friendly city to friendly city**. Fighters newly built or landing there automatically receive the destination order; legs may not exceed 20 fuel spaces. (pp. 39–40.)

**IMP-065 [M]** `Patrol To` makes a unit travel repeatedly between its current and target locations. A fighter must start in a friendly city or on a carrier. City-based fighter patrols have a **ten-cell radius/limit**, carrier-based patrols **six cells**; the latter maintains the patrol geometry relative to the carrier's moving position. (pp. 46–47.)

**IMP-066 [M]** `Go Direction`, `Go Random`, `Move To`, and `Escort Ship` are available subject to type restrictions. Fighters cannot `Go Random`. Escorting ship tracks a target ship from behind within approximately two cells; escorting targets and movement differences matter. (pp. 38–41, 45–46.)

**IMP-067 [?]** Exact pathfinding tie-breaks, shortest-path metric including diagonals, escort-following logic, fuel recharge timing, and embarked-unit move availability require reference tests.

## 8. Fog of war and intelligence

**IMP-070 [M]** A player begins knowing only the initial city and surrounding space. Units normally reveal nearby squares; **enemy unit positions are remembered from their last observation**, even after they may have moved. Visible terrain/history must not be replaced with omniscient reality. (pp. 19, 42.)

**IMP-071 [M]** A unit generally detects enemy units in its **eight adjacent cells** (subject to unit-specific exceptions such as submarines). A player's map records latest intelligence, not current enemy truth. (pp. 19, 21–26.)

**IMP-072 [M]** A fighter passing beside an enemy city obtains an intelligence snapshot of that city's production; the information can become stale and is refreshed by revisiting. (p. 42.)

**IMP-073 [I]** Store separate `actualWorld` and per-faction `knownWorld` states. **Neither AI nor player-facing APIs may retrieve hidden live enemy state** except through an explicit authoritative rules transition. An AI with a knowledge advantage would violate the strict-classic fairness principle stated for the game.

**IMP-074 [?]** Which map objects become stale, visibility refresh timing, and whether a city itself has any passive detection require a test matrix.

## 9. Classic orders and information interfaces

**IMP-080 [M]** Player orders: `Go Home`, `Go Direction`, `Go Random`, `Move To`, `Patrol To`, `Escort Ship`, `Sentry`, `Clear Orders`, `Load Ship`, `Unload Ship`, `Skip Move`. Commands include `Wait`, `Activate`, `Flight Paths`, `Survey`, `Group Survey`, production control, save/load, and informational reports. (pp. 29–53.)

**IMP-081 [M]** Survey mode lets a player inspect the current known map and issue orders outside the normal move prompt; Group Survey targets multiple units. Activate allows direct selection of a still-mobile unit. (pp. 29–36, 51–52.)

**IMP-082 [M]** Reports include world map, production view, unit/ship damage listings, status/war report, and last-turn combat replay/report. A modern interface may make these more accessible but must show information available to the corresponding faction only. (pp. 35–38, 42–43, 48–53.)

**IMP-083 [N]** Browser interface additions allowed: pan/zoom, mouse/touch selection, keyboard shortcuts and remapping, larger hit targets, accessible color/symbol contrast, contextual information panel, searchable own-unit list, and readable event log. These may **not** move a unit, reveal hidden terrain, or change a probability without an explicit rules command.

**IMP-084 [N]** The UI should visually distinguish `manual move` from `standing order`. Route preview may display **only known terrain**, and any suggested path must be derived from information and legal behavior available to the player.

## 10. AI and multiplayer fidelity

**IMP-090 [M]** Game setup permits computer opponents marked **Standard** or **Expert**, and per-faction production/combat efficiency ratings. The original supports hot-seat multiple human players and play-by-mail via transferred save files. (pp. 9–14.)

**IMP-091 [I]** Implement deterministic, rules-constrained AI using the same legal action service and its faction-specific knowledge. Stronger play is allowed only through strategy, not private visibility or hidden combat bonuses beyond the explicitly chosen game setup.

**IMP-092 [?]** Original Standard/Expert decision policies, their initial efficiency presets, computer surrender heuristics, and the precise effects of efficiency sliders require further verification before claiming AI parity.

**IMP-093 [I]** Include a replayable serialized turn history internally for test debugging. Replay logging is **engineering infrastructure**, not an extra game mechanic.

## 11. Browser engine and persistence — implementation contract

These items define *Empirata's implementation*, not historical features.

**IMP-100 [I]** Separate pure TypeScript simulation engine from the React UI and Canvas renderer. Rendered animation and touch gestures must never change game resolution logic.

**IMP-101 [I]** All authoritative game changes occur through validated typed commands, e.g. `moveUnit`, `issueOrder`, `selectProduction`, `startPlayerTurn`, `endPlayerTurn` and `resolveCombat`. Avoid calling UI handlers from engine rules.

**IMP-102 [I]** Implement seeded RNG and log RNG consumption for reproducibility; the choice of PRNG must not be presented as the original game's exact random sequence.

**IMP-103 [I]** Persist versioned save files to IndexedDB; support explicit JSON export/import. Save must include actual and faction-known worlds, turn/player phase, production progress, RNG state, unit orders, transported units, fuel, damage, and event state.

**IMP-104 [I]** Keep a `ruleset: 'interstel-2.05'` identifier in each save. Future features must not silently mutate that ruleset.

**IMP-105 [N]** Modern input must remain functionally equivalent across keyboard/mouse/iPad touch. Keyboard focus must never cause a unit to move unexpectedly when the user is scrolling or entering a filename.

## 12. Acceptance tests (initial conformance suite)

The following assertions are testable against manual-confirmed behavior, without guessing original internal algorithms.

| ID | Test | Expected result |
|---|---|---|
| T-001 | Attempt movement into outermost map row | Rejected |
| T-002 | Army makes a diagonal move | Allowed once, consuming its turn movement |
| T-003 | Destroyer moves through three open sea cells | Three movement spaces consumed |
| T-004 | Inland city selects battleship | Not allowed |
| T-005 | Coastal city produces its first army | Six turns at 50% production efficiency |
| T-006 | Same city continues producing armies | Five turns per additional army at 50% |
| T-007 | Change unfinished city production to fighter | Previous work discarded; fighter starts initial production |
| T-008 | Fighter flies 20 cells without refueling | Fuel exhausted; crash if still airborne |
| T-009 | Carrier with 3 damage points | Maximum fighter capacity 5 |
| T-010 | Transport with 1 damage point | Maximum army capacity 4 |
| T-011 | Cruiser reaches 4/8 damage | Movement speed becomes 1 |
| T-012 | Battleship in friendly coastal city is damaged, remains docked for a turn | Recovers one damage point |
| T-013 | Army successfully captures city | City changes owner; attacking army becomes immobile garrison |
| T-014 | Cruiser bombards adjacent coastal army | Costs one movement point; cruiser does not enter land |
| T-015 | Assign `Go Random` to a fighter | Refused |
| T-016 | Sentry unit sees adjacent enemy | Wakes or requests attention according to original orders behavior |
| T-017 | Give `Move To` order toward known enemy | No automatic combat initiation |
| T-018 | Enemy unit leaves player's visual range | Last known enemy position is retained as historical intelligence |
| T-019 | Fighter observes enemy city production, leaves, production changes | Stored intelligence does not update until rescouted |
| T-020 | Assign fighter carrier-based patrol beyond six-square limit | Refused |
| T-021 | Load a transport to capacity via `Load Ship` | Ship wakes and requests next order |
| T-022 | Save during partial turn, reload | All command-relevant state resumes identically |

**Tests requiring executable validation before asserting pass/fail:** RNG sequence, combat initiative/exchange formula, city-capture probabilities, production rounding, AI difficulty settings, pathfinding tie-breakers, global unit cap, detailed fighter refueling timing, start-city placement, enemy surrender conditions.

## 13. Resolved decisions and outstanding questions

### Locked design decisions

1. Interstel IBM PC v2.05 rules, **not** Bright v5.0 or *Empire Deluxe*.
2. Exact original eight-unit roster and standard production/movement/damage values.
3. Classic turn-based city-production economy and city-garrison capture rule.
4. Persistent last-known-intelligence fog of war; no omniscient AI.
5. No gameplay innovations, alternate resources, tech trees, or rule-changing conveniences.
6. Browser/desktop/iPad UI is a different *presentation of the same simulation*.

### Open verification queue (priority order)

- **V-01 High:** Combat exchange algorithm: probabilities, attack/defense multipliers, initiative, and resolution.
- **V-02 High:** City assault and capture probabilities; neutral versus enemy-city behavior.
- **V-03 High:** Exact production progress timing, efficiency rounding, and capture resets.
- **V-04 High:** Visibility/detection matrix, particularly **whether cities detect submarines**, update order, and units/cities with occupants.
- **V-05 High:** Turn sequencing, manual move and interrupt order, cargo landing/reloading mechanics.
- **V-06 Medium:** Pathfinding, flight, escort, patrol, and precise Go Home behavior.
- **V-07 Medium:** `.MAP` format, map selection, generation, validation, and starting city selection.
- **V-08 Medium:** Standard/Expert AI behavior and per-player default efficiency presets.
- **V-09 Medium:** Original maximum-unit saturation rule.
- **V-10 Low:** Service record, scoring, surrender calculation, settings, naming, and less central reports.

### Validation method

For each open item, preserve a compact fixture describing `(initial state, command(s), observed result, reference/version, confidence)`. Compare against Interstel DOS v2.05 gameplay or disassembled behavior only when properly sourced/authorized. An observed behavior on a different platform or patch remains provisional until version differences are documented.

## 14. Proposed build order

1. **Specification fixtures** — encode unit constants, grid and city rules, tests T-001 through T-007, and discrepancy tracking.
2. **Deterministic engine** — world, turn state, orders, fog, production, and persistence. Keep uncertain combat aspects behind replaceable versioned policy functions.
3. **Rules parity test harness** — record and compare small observed cases before committing exact combat code.
4. **Classic gameplay completion** — all eight units, ships/fighters/cargo, capture, AI, status and save/resume.
5. **Browser-first controls** — map renderer, accessible keyboard shortcuts, mouse + touch, direct city/ship interaction, compact order panels.
6. **Parity and polish** — compare end-to-end game behavior; only then call the release `classic-compatible`.

## Sources and provenance

- **[S1] Primary:** Interstel Corporation, *Empire: Wargame of the Century — Star Fleet Planetary Task Force Command Manual*, IBM PC v2.05, second printing August 1988. Transcribed web edition: <https://oldgamesdownload.com/manual/empire-wargame-of-the-century-dos-manual-english/>. Scanned original linked from that page. The web text is imperfectly extracted; verify ambiguous tables in page images or another scan before implementation.
- **[S2] Cross-check:** Mark Baldwin, 27 June 1988, v2.05 change notes (Atari ST distribution). <https://www.atarimania.com/games/atari-st-games-empire-wargame-of-the-century-9225>. Used only where changes align with the DOS v2.05 manual; not proof of identical platform-specific implementation.
- **[S3] Distinct edition, *not* authority for Empirata:** Walter Bright, *Empire: The Wargame of the Century, Version 5.0* (pre-Interstel rules). <https://www.abandonwaredos.com/docawd.php?idg=1423&sf=Empire_manual.txt&sg=Empire%3A+Wargame+of+the+Century&st=manual>.
- **[S4] Earlier user project research:** *Empire Research Notes* and *Empire Dossier Working Draft*, created July 2026, supporting project context; superseded by the v2.05 manual on rules disputes.

**Originality and distribution:** Empirata should use original implementation code, artwork, visual assets, and prose. Historical mechanics may be documented and independently implemented, but original copyrighted game files, art, source, and manuals should not be bundled without permission. Name clearance for “Empirata” is separate from gameplay fidelity.

---

*End of v0.1. Any unknown historical rule remains an explicit open item rather than an assumed rule.*
