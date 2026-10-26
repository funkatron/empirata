# Empirata development roadmap

This is the working roadmap for the browser-based Empire rules laboratory. Items are proposals until marked implemented and verified. Historical rule fidelity, reproducibility, and accessibility remain core constraints.

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

## Priority 2 — Computer-versus-computer observability

- Automatic alternating faction viewpoints (implemented in source; preserve fog-of-war separation).
- Both-player city/unit scorecards (implemented in source).
- Optional synchronized side-by-side maps on wide screens, with each player's own fog of war and no omniscient leakage.
- Match statistics: cities captured, production, combat losses, units sunk, idle/stalled turns, transports built/loaded/landed, and reproducible seed.
- Bounded campaign and replacement-fleet endurance tests; compare AI strategy versions across identical seeds.

## Priority 3 — Historical fidelity and deeper strategy

- Verify remaining rule ambiguities against Interstel DOS 2.05C behavior.
- Improve logistics, multi-objective strategy, pathfinding, attrition recovery and victory/end-state detection.
- Keep modern experimental AI separate from claims about the original DOS opponent.

## Decision record

2026-10-26: Requested by the project owner: full-world pinch-to-zoom-out on iPad, and a semantic UI hierarchy in which game-wide settings move to a top-level Game menu while the sidebar is reserved for contextual controls and logs. This is a **roadmap entry**, not a claim that the UI changes have been implemented.
