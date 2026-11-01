# Empirata development roadmap

This is the working roadmap for the browser-based Empire rules laboratory. Items are proposals until marked implemented and verified. Historical rule fidelity, reproducibility, and accessibility remain core constraints.

Strategic priorities: [capture and sustain cities](AI_CAPTURE_STRATEGY.md).

## Strategy/tactics baseline and plan (2026-10-31)

The [42-campaign study](evaluation/strategy-baseline/BASELINE_INTERPRETATION.md) records 8,150 rounds across matched sparse/dense worlds, swapped factions and a nearby-rival cohort. All saves and unit-accounting checks validate; time-limited games remain censored. The [overall strategy and tactics plan](STRATEGY_AND_TACTICS_PLAN.md) uses that evidence to prioritize faction-neutral control, failure diagnosis, access-aware allocation, concentrated hostile operations and sustained capture.

PR #43's default harbor setup and PR #44's shared controller are separate foundations. The generated baseline is unaffected by #43; #44 has limited early decision-preservation checks, not a demonstrated campaign-strength improvement. No strategic tuning is implemented by the study. Preserve the raw baseline and evaluate later policies on fixed horizons and holdout maps.


Detailed execution design: [Technical implementation plan](TECHNICAL_IMPLEMENTATION_PLAN.md).

## Manual research follow-up (2026-10-30)

The [expanded manual reference](manual/README.md) records selected scan checks,
strategy guidance and twelve implementation findings. Prioritize city/submarine
and observer-specific detection, combat factor verification, sentry activation,
and fighter order constraints before evaluating additional fleet/air composition.
The manual's major-invasion advice supports distant convoy rendezvous and repeat
reinforcement, while neutral expansion must continue during war. Add evaluation
maps near the documented 60–70-city density and validator constraints alongside
unusual stress maps. Remaining visual checks and independent review stay open.

## Gameplay issue — Lost ports and stale ownership (2026-10-27)

Round 753/758 screenshots show Blue with 186–189 units and three cities, with remembered friendly city markers where Red shows ownership. Capture notifications must update the former owner's ownership memory without revealing subsequent enemy production or movements. Add lost-port recovery objectives using known reachable targets, and bound reserve production even when no transport exists. Test landlocked starts and loss of the last port; do not assume a fleet can always be rebuilt. Use the supplied save as diagnostic evidence; validate fixes in newly constructed games. Existing-save repair and backward compatibility are explicitly out of scope.

## Gameplay issue — Production after city capture (2026-10-27)

**User observation:** Captured cities appeared not to start producing units. Not yet reproduced; do not assume whether this is an engine, AI assignment, or display issue.

- Reproduce captures by both factions, including computer-versus-computer play. Trace ownership, production selection, progress, and first-unit completion across subsequent turns.
- Check whether the AI assigns production on its next eligible turn, and whether human players receive a clear production-selection prompt or indication.
- Verify capture-related production resets and any delay against the original rules; distinguish deliberate timing from a stalled city.
- Add regression tests for production assignment and eventual unit completion, plus save/reload continuity. Confirm the inspector displays the actual state.

Prioritize this investigation alongside reconnaissance: expansion must result in usable production capacity.

## Campaign evaluation follow-up (2026-10-30)

Twelve 100-round clean campaigns across three layouts, two seeds and swapped
starts establish a post-PR-17 baseline. Eight gained one city; four gained none.
See [results and measurement limits](evaluation/2026-10-30-campaign-outcomes.md).
Next: trace discovery-to-capture delay, land access, port access and landed-unit
objectives in ordinary campaigns before tuning invasion size or adding fighters.
Long-distance transport rendezvous remains open.

## Immediate priority — General gameplay reconnaissance (2026-10-27)

Scenario success is regression evidence, not evidence of a generally effective strategy.
Withdraw the proposed transport-plus-eight-armies prerequisite for naval scouts.

1. Enable ground reconnaissance from the opening turn, independent of fleet or reserve size.
2. Select production from faction-known geography and objectives: reachable land expansion, unexplored navigable coastline, and useful overseas troop movement. Compare early naval scouts with transport exploration; do not prescribe either universally.
3. Preserve useful production progress and avoid fleet-wide unit-count thresholds as substitutes for local needs. Reserve troops for logistics without preventing early exploration.
4. Evaluate multiple map layouts and seeds: inland starts, open coast, isolated islands, blocked harbors, and nearby enemies. Record discoveries, captures, losses, idle rounds, and computation cost. Include save/replay and hidden-world equivalence checks.

Implement incrementally; keep existing invasion fixtures as regressions. Do not claim general improvement from a single fixture or silently tune test expectations to new behavior.

## Priority 1 — Map navigation and semantic UI architecture (2026-10-26)

### 1. Touch zoom, pan, and fit-entire-world

**Problem:** The map currently has +/- zoom buttons and single-pointer panning, with a fixed minimum tile size. A player on an iPad cannot zoom out far enough to see the entire 100 × 60 world. Touch gestures should behave as users expect.

**Required behavior**

- Two-finger **pinch inward zooms out** and **spread outward zooms in**, following conventional iPad map gestures. Single-finger drag pans; a tap selects. A two-finger gesture must never accidentally select, move, or attack.
- Pinch zoom remains anchored on the midpoint of the fingers: the world point beneath the midpoint stays in place as scale changes. Pan with two fingers during the same gesture.
- Support continuous zoom to **Fit entire map** even when individual tiles become tiny. Compute the minimum tile scale from the available map viewport and world dimensions, not a hard-coded 11px floor. No arbitrary zoom ceiling preventing the whole world from fitting.
- Add a map-local **Fit world** control beside zoom in/out and recenter. The existing +/- buttons and keyboard alternatives remain for discoverability and accessibility.
- At overview scales, simplify gridlines, labels, and unit glyphs as needed; retain recognizable land, sea, fog and city/unit markers where feasible. Do not make microscopic tiles individually tappable as if they were usable targets; offer zoom-to-selection or tap-to-zoom behavior.
- Zoom and pan should work in both iPad portrait and landscape, and after resize/orientation changes. Recalculate fit scale on viewport change while avoiding disorienting jumps at ordinary zoom.
- Touch interaction should not scroll the page while manipulating the map, but ordinary page scrolling outside the canvas must continue.
- Preserve viewport center across zoom and support a clear path from whole-world overview back to the currently selected unit/city.
- Prefer non-blocking gestures, avoid accidental clicks after touch end, and respect reduced-motion settings if animation is introduced.

**Acceptance tests**

1. Simulated two-pointer movement changes zoom in the correct direction and preserves the world point beneath the gesture center.
2. Dragging one or both pointers pans without generating an order or a map click; a true tap still selects.
3. Fit world shows all 100 × 60 cells without cropping at representative iPad portrait and landscape sizes and a narrow phone-sized viewport.
4. Map zoom is reversible, does not yield NaN/negative scales, and stays within computed bounds after resize.
5. Existing +/- buttons, pointer controls and keyboard input continue working.

### 2. Semantic hierarchy and control locality

**Principle:** The scope of a control should match its location in the interface. Global controls belong in global navigation; map controls belong on/near the map; selected-object controls belong by the selection; reports belong by the activity they describe. The visual hierarchy should communicate the effect and risk of an action.

**Proposed structure**

| Scope | Placement | Examples |
| --- | --- | --- |
| Whole game / persistent state | **Top-level Game menu** in the header | New game, choose scenario, restart, load/import, save/export, preferences, quit/return if applicable |
| Simulation session | Header near round indicator or a dedicated **Simulation** menu | Next round, play/pause, speed, batch advance, spectator mode; only show relevant actions in AI-vs-AI |
| Map viewport | Compact toolbar physically attached to the map | Pinch hint, +/−, Fit world, recenter/focus, optional layer/legend toggles |
| Selected city/unit | Selection inspector in sidebar (or contextual panel where practical) | Movement, orders, production, cargo, details, legal actions |
| Game state / feedback | Sidebar adjacent to map | Current player, cities, units, visible threats, event log, turn report, alerts |
| Help | Local help icons by each section heading; global Help menu for reference | Tooltips, gesture guidance, keyboard shortcuts, rules reference |

**Specific migration:** Move **Start Close Quarters**, **Original test map**, **AI Invasion**, **Computer vs computer**, **New skirmish**, and save/import/export controls out of the map-adjacent sidebar into the top-level **Game** menu (with clear confirmation before destructive reset). The sidebar should instead prioritize **selection controls and a readable event/turn log**, with game status visible without scrolling when practical. Keep viewport controls in the map toolbar.

**Behavior and usability**

- Use explicit labels for actions whose scope is ambiguous; icon-only buttons only where conventions are clear and accessible names/tooltips exist.
- Make the global Game menu easy to find and operate by touch, keyboard and assistive technology. Correct focus management, Escape-to-close, click-outside-to-dismiss and meaningful accessible roles.
- Preserve a persistent, obvious way to advance turns; avoid hiding the primary action in a deep menu.
- Group related settings by *what they affect*, not merely by implementation module. Avoid repeating the same action in unrelated panels.
- Use progressive disclosure for rarely used/debug-only tools. Prefer concise section titles and help icons beside headings over long explanatory paragraphs and help icons at the bottom.
- Separate **game-changing operations** (new scenario, import, reset) from **observation-only operations** (spectator viewpoint, map zoom) visually and semantically.
- In portrait, keep the map primary and make inspector/log easy to reach without losing map context. In landscape, use the side panel for controls and reports rather than setup commands.
- Avoid floating inspectors or palettes obscuring active map regions; ensure touch targets remain accessible without consuming excessive screen space.
- Preserve existing controls, saved games and scenario workflows through the migration; update documentation and onboarding text.

**Acceptance tests**

1. Every global state-changing action is reachable from the Game menu and absent from the ordinary selection/log sidebar.
2. Zoom, Fit world and focus remain map-local; selected-unit actions are only shown in selection context.
3. AI playback and viewpoint controls appear only when relevant; changing the view never changes game state.
4. Keyboard navigation, screen-reader labeling, touch, and iPad portrait/landscape layouts pass a usability audit.
5. The sidebar remains useful when nothing is selected: status plus recent events/turn report, not a large scenario setup panel.
6. Regression tests cover new-game confirmation, import/export, simulation playback, selection, and no accidental orders during gestures.

**Implementation sequence**

1. Capture full-page iPad portrait and landscape screenshots; inventory controls and classify each by scope and risk.
2. Implement gesture-safe camera math and Fit world, with pure testable camera helpers before wiring pointer events.
3. Add top-level Game menu; migrate scenario and save controls without removing working behaviors.
4. Rework sidebar for selected-object actions, status and event log; reduce text clutter and place local help beside section headings.
5. Audit responsive layout, touch targets, focus/keyboard/screen-reader access, and screenshots. Fix any regressions.
6. Run engine and UI smoke tests; confirm successful standalone bundle and GitHub Pages deployment.

## AI role allocation and neutral expansion (2026-10-30)

Mobile scouting must exclude reserved city defenders and remain available with a
small fleet. Destroyers with exhausted reconnaissance should escort a loaded
transport or hold and reassess, instead of moving without a useful goal.
See [unit roles and proposed patrol assignments](ai-unit-roles.md). Follow up with
escort distribution, corridor coverage and role-transition diagnostics. Other
naval and air roles remain proposals pending rules and campaign verification.

2026-10-31 follow-up: [additional unit roles](AI_ADDITIONAL_UNIT_ROLES.md) records
escort replacement, fresh-transport interception and coastal perimeter duty for
naval combat ships. Perimeters favor charted friendly landmasses without known
hostiles ashore; unseen interiors remain reconnaissance gaps. New submarine and
heavy-ship production, coordinated bombardment and shared hunter/escort allocation
remain planned work.

## Observer performance with large armies (2026-10-30)

**Implemented follow-up (2026-10-31):** observer batches refresh the map and save
once after the selected round count completes. Progress still updates between
rounds; Pause refreshes and saves the completed partial batch. Six coordinator
checks cover counts 1/10/50/100, cancellation and repeated playback. Browser smoke
checks now assert one map redraw per batch and observe live progress for Pause.
No measured overall speed improvement is claimed.

**Observed:** AI turns become noticeably slower as unit counts grow. Investigate
whether suppressing intermediate round movement/map redraws speeds up observer
mode. This is a performance hypothesis, not a measured diagnosis.

- Profile AI decisions, pathfinding, state cloning, view construction and map/UI
  rendering separately at representative small and large unit counts.
- Compare current playback with rendering only the final state of a 10/50/100-round
  step, plus an optional reduced redraw cadence for continuous playback. Check
  whether the present implementation animates moves or merely redraws round ends;
  avoid removing rendering work that does not actually occur.
- Preserve the same rounds, RNG draws, decisions and final save under every
  display policy. Keep progress/spinner updates, cancellation between rounds,
  accessible status and responsive input even when the map is not redrawn.
- Measure wall time, time spent computing/rendering, pause latency and memory on
  iPad portrait/landscape. Include prolonged high-unit campaigns; do not infer
  benefits from the initial small-force scenario alone.
- If computation dominates, separately investigate bounded/reused navigation,
  repeated scans and cloning rather than claiming display suppression solves it.

**Verification checklist**

- [ ] Profile representative large-unit observer sessions.
- [ ] Compare current redraws with batch-end/reduced redraw modes.
- [ ] Confirm identical deterministic outcomes and save/resume behavior.
- [ ] Confirm responsive progress and pause on iPad.
- [ ] Document measured benefit and remaining computation costs.

## Priority 2 — Computer-versus-computer observability

- Automatic alternating faction viewpoints (implemented in source; preserve fog-of-war separation).
- Both-player city/unit scorecards (implemented in source).
- Optional synchronized side-by-side maps on wide screens, with each player's own fog of war and no omniscient leakage.
- Match statistics: cities captured, production, combat losses, units sunk, idle/stalled turns, transports built/loaded/landed, and reproducible seed.
- Bounded campaign and replacement-fleet endurance tests; compare AI strategy versions across identical seeds.

## Priority 3A — Comprehensive original-manual rules and unit audit

Conduct a thorough, page-by-page review of the original **Empire: Wargame of the Century (Interstel DOS 2.05C)** manual, treating the manual as the primary documented-rules source. Cross-check every claim against the current engine, UI, tests, and scenario fixtures; do not assume current implementations are correct.

- Inventory **every unit type** in the manual and compare names, roles, movement allowances, terrain/domain restrictions, sight/reconnaissance, fuel and refueling, hit points/damage, combat effectiveness, production costs and first/repeat build times, carrying capacity, loading/unloading, repairs, and special orders.
- Audit **all game rules**, including turn sequence, movement, combat odds and resolution, city capture and ownership, production, transport/carrier logistics, fog of war, exploration, stacking, terrain and coastal ports, aircraft operations, automated orders, end conditions, and edge cases.
- Build a traceable **manual-to-implementation matrix**: manual section/page, exact rule summary, corresponding source function, existing test, status (matches / differs / unimplemented / ambiguous), and action required.
- Distinguish documented rules from observed DOS 2.05C behavior, assumptions, and deliberate modern Empirata extensions. Where the manual is silent or ambiguous, document the uncertainty rather than inventing a definitive rule.
- Create or improve deterministic regression tests for each rule and unit; correct engine behavior only after establishing the relevant evidence. Prioritize gameplay-impacting discrepancies.
- Verify that UI labels, unit statistics, tooltips/help, and any player-facing rules explanations agree with the validated reference.
- Publish an auditable rules-conformance report and maintain a checklist of unresolved differences.

**Completion criteria:** Every manual unit and substantive rule is accounted for, with source citations, implementation status, and either a passing regression test or an explicitly documented gap.

### Original DOS 2.05C executable re-examination

Treat the original DOS game as a complementary primary source to the printed manual. Revisit the previously supplied 2.05C executable and existing `DOS_CALL_SITE_AUDIT_2026-10-23.md`, with an evidence-driven plan:

- Establish the exact executable version/hash, relevant game data, repeatable DOSBox-X/debugger environment, and saved test fixtures; keep commercial binaries and raw disassembly out of the public repository.
- Run controlled A/B gameplay experiments for ambiguous mechanics: combat rolls and damage, city assault and capture, unit detection, repair, cargo loss/capacity, aircraft fuel, order interruption, and production/turn timing.
- Compare equivalent states and commands in DOS and Empirata, documenting observations, uncertainty, and edition/patch differences rather than assuming the manual or existing code must be correct.
- For unresolved behaviors, trace targeted executable control flow and game-state writes, rather than inferring RNG or rules from raw linear disassembly. Confirm actual runtime addresses and call sites.
- Investigate original AI decisions separately from rules fidelity, including reconnaissance, production, embarkation, amphibious assault, and stalemates; do not silently import original AI quirks into the modern experimental opponent.
- Preserve a reproducible evidence record for each case: DOS build/hash, setup or save, commands, observations, expected Empirata behavior, source location, confidence, and regression test.
- Explicitly flag cases that cannot be resolved without an executable, debugger, or original save fixture; never claim parity from inference alone.

Use findings in the **mandatory independent testing and wargaming second pass**. Prioritize high-impact disagreements between manual, executable, and Empirata.

### Mandatory independent second pass — testing and wargaming review

After the primary manual-to-engine audit, conduct a separate adversarial review from **both** perspectives:

- **Testing expert:** Challenge test oracles and source assumptions; examine branch/boundary coverage, combat probability distributions, invariants, property-based and metamorphic tests, deterministic replay/save-resume, fog-of-war information leaks, malformed states, and cross-rule interactions. A test that reproduces the implementation's own assumptions is not sufficient evidence of historical correctness.
- **Wargaming expert:** Evaluate the strategic consequences of the validated rules, including unit roles and counters, scouting economics, force concentration, production opportunity costs, transport vulnerability, amphibious logistics, beachhead selection, attrition, city capture, stalemates, and victory progression. Distinguish historically intended mechanics from shortcomings of the modern AI.
- Construct adversarial scenarios in which individually correct mechanics interact badly (e.g., embarkation timing plus movement allowances, fog plus submarine detection, transport damage plus cargo capacity, city defense plus landing tactics).
- Publish a **separate second-pass findings report** with severity, manual evidence, reproducible fixture, expected/actual results, strategic impact, and corrective regression test. Re-run representative autonomous campaigns after significant fixes.

**Second-pass exit criteria:** Every high-severity finding is fixed and regression-tested or explicitly documented as unresolved; remaining risks and original-DOS ambiguities are visible. Do not declare the audit complete solely because the first-pass tests pass.
 No unverified claim of full historical fidelity.

## Priority 3 — Historical fidelity and deeper strategy

- Verify remaining rule ambiguities against Interstel DOS 2.05C behavior.
- Improve logistics, multi-objective strategy, pathfinding, attrition recovery and victory/end-state detection.
- Keep modern experimental AI separate from claims about the original DOS opponent.

## Priority 2A — Reconnaissance, efficient exploration, and amphibious safety

**Observed issue (2026-10-26):** A computer-versus-computer game reached round 498 with only two controlled cities and a large accumulation of armies. Passing 100-round transport movement tests does not demonstrate meaningful conquest. The owner also observed loaded transports approaching hostile armies too closely and risking the loss of all embarked troops.

### Reconnaissance and exploration pathfinding

- Define explicit roles for ground scouts, naval scouts, troop transports, and assault armies. Transports should not double as expendable scouts when safer reconnaissance units are available.
- Prefer frontier destinations by expected **new tiles revealed per movement point**, navigable connectivity, nearby strategic objectives, and information freshness. Penalize repeated visits, loops, blocked routes, and already-covered terrain.
- Track each faction's discovered terrain, city sightings, enemy sightings, and age of intelligence. Never read hidden opponent positions or actual unexplored terrain to plan a move.
- Use a shared faction intelligence model: scout discoveries should influence transport routes, beachhead selection, and army objectives.
- Improve route planning for known terrain with bounded search work and reusable navigation data; replan when new information or obstacles invalidate a route.
- Instrument new cells revealed, redundant moves, stalled turns, exploration coverage, and CPU time per AI round.

### Transport survival and beachhead selection

- Avoid known enemy army attack ranges when planning transport approach and docking; distinguish currently visible threats from stale sightings.
- Prefer a safe offshore staging position and a viable landing tile with a land route toward the objective. Do not sail directly into a known hostile port or cluster of defenders simply because it is geographically closest.
- Coordinate naval scouting, troop delivery, disembarkation, and the subsequent land assault; retain a retreat/reposition option when the beachhead becomes unsafe.
- Treat losses of a transport plus its cargo as a high strategic cost. Evaluate risk against the entire embarked force, not only the hull.
- Under fog of war, danger remains uncertain; make conservative decisions using available intelligence rather than giving the AI omniscience.

### Acceptance tests

1. A ground or naval scout reveals substantially more unique map cells than an aimless nearest-neighbor baseline under a fixed deterministic seed.
2. Known hostile armies near one beach cause a loaded transport to select a safer reachable landing, when one exists.
3. Stale sightings influence caution but do not permanently block a coast without fresh evidence.
4. A 100–200-round ordinary AI-vs-AI campaign reports city discoveries, attempted landings, successful landings, city captures, stalled rounds, and loaded-transport losses; test for strategic progress, not just movement.
5. Save/resume yields identical decisions and results; no faction receives information from the opponent's private fog-of-war state.
6. Exploration and navigation work remain bounded as the map becomes known and unit counts grow.

## Decision record

2026-10-26: Requested by the project owner: full-world pinch-to-zoom-out on iPad, and a semantic UI hierarchy in which game-wide settings move to a top-level Game menu while the sidebar is reserved for contextual controls and logs. This is a **roadmap entry**, not a claim that the UI changes have been implemented.

2026-10-26: Added reconnaissance efficiency, information-aware pathfinding, and threat-aware amphibious landing criteria after reviewing the round-498 AI-vs-AI screenshot and transport exposure near enemy armies.

### Round-764 save investigation

Confirmed from the supplied campaign save: Blue has 191 armies, one carrier, no transport, and three cities. Its intelligence incorrectly retains friendly ownership for `c-blue` and `c-frontier`, both actually Red-owned. Red has 25 armies, one transport, six cities, and every city has null production. The current faction-wide reserve policy pauses Red factories while allowing Blue's unlimited army production because Blue has no transport.

The capture-event fix prevents new stale ownership records but does not repair existing saves. No existing-save migration or repair is required. Regression coverage targets future captures and new games. Production should respond to local expansion, defense, reconnaissance and logistics demand rather than merely removing all limits or assigning every captured city unconditional production.

### Local reserve production — first implementation

Production now counts unembarked armies connected to each city through faction-known land, stopping at hostile cities and unknown terrain. The provisional eight-army reserve ceiling applies without requiring a transport; disconnected reserves no longer suppress a new factory. This is a bounded correction, not a completed strategic production planner. Remaining work: reserve demand proportional to reachable objectives/threats, coordinated factories, early naval reconnaissance, fleet capacity and port recovery. Existing global transport selection remains a limitation.

## Priority — Clean campaign openings and air-unit strategy (2026-10-27)

2026-10-30: AI factories now remain active rather than pausing at reserve
thresholds. Each city reserves a stationed army and prioritizes producing a
replacement when missing; transport loading excludes those defenders. Fleet
targets scale without fixed ship ceilings. Hostile objectives can attract
multiple transports, nearby groups coordinate larger landing waves, and strong
expeditions can make opportunistic distant coastal scout drops while retaining
their assault reserve. Long-distance rendezvous scheduling remains open work.

2026-10-29: Navigation now applies the same beach eligibility checks as actual
unloading. It continues around a city-only or occupied shore instead of holding
at a position where cargo cannot land. Seven paired 200-round generated-map
settings found one additional Red city in three settings and unchanged final
holdings in four; this small self-play sample does not establish a general
strategic advantage. See the [approach evaluation](evaluation/2026-10-29-landing-approaches.md).
Enclosed-sea production decisions, ground exploration speed, recruitment and
rendezvous remain open; fighter strategy remains a separate priority below.

### Clean computer-versus-computer campaign
- Make a clean campaign the normal AI-vs-AI evaluation: one owned city per faction, no starting mobile units, neutral remaining cities, zero production progress, and initial production chosen by the AI.
- Initialize fresh knowledge from starting cities only. Remove inherited Close Quarters encounters, scouting memories, cargo, event logs and production advantages. Retain the constructed skirmish as a separately labeled QA fixture.
- Verify the no-starting-units detail against the actual DOS 2.05C manual/executable before labeling the opening historically exact. Current specification IMP-002 cites manual pp. 15–16 for one starting city and initial production.
- Use reproducible varied seeds/layouts; validate legal starting-city placement and assess coastal access rather than guaranteeing a port without source evidence.
- Test production through first completion, early discoveries, expansion and bounded campaign progress. Compare both factions under the same policy. Existing tactical fixtures remain regressions, not primary strategy benchmarks.

### Air-unit strategy
- Include fighters in production decisions, particularly for inland cities that cannot build ships. Evaluate scouting value, local defense and interception against production time and army demand.
- Implement fuel-aware outbound and return routes using known friendly cities/carriers. Preserve a refueling reserve and replan when a destination is captured; do not send aircraft on inevitable fuel-loss missions.
- Feed aerial discoveries into faction intelligence and land/naval planning, retaining normal detection restrictions. Fighters cannot capture cities; discovered overseas objectives still need army logistics.
- Add carrier basing and coordinated naval air operations after reliable city-based flight and refueling.
- Validate scouting, combat, fuel, refueling and carrier rules against manual evidence. Benchmark useful discoveries, survival, objective support and cost across clean campaigns, not just prepared encounters.
