# UI review (Raskin principles) — OODA, 2026-11-25

## Observe
- Order modes (Move To, Go Direction, Patrol, Escort) were invisible: the next tap anywhere committed and executed the order (`src/ui/main.ts` `choosingDestination`).
- No undo; new games used `window.confirm`.
- Feedback lived in the page footer; combat results only in Reports; the same help text appeared in four places.
- Reports were plain text: `Cargo u12 was lost` leaked an ID (`adjudication.ts`, `game.ts`), `(ALG-AI-003)` leaked an internal tag; names could not be tapped.
- No count of units awaiting orders; 30 px buttons; Reports card capped at 200 px; CvC showed three advance controls.

## Orient
- UI only, except the two cargo-loss log strings (report text; no RNG or move-order change). Saves differ only where cargo is lost.
- AGENTS.md layout-stability rule: toggled chrome keeps its slot (`visibility:hidden`); overlays (order banner) are ephemeral.
- Parallel AI-speed work touches `src/engine/ai/` and knowledge; keep engine edits minimal.

## Decide
- One PR, one commit per area: reports, order modes, undo, feedback/markers, awaiting orders, layout.
- Undo snapshots the game before each player action; any change in `rng.draws` clears the history so dice cannot be re-rolled.
- Report names are parsed from existing `id (Name)` labels (`reportParts`), so no event schema or save-format change.

## Act
- `reportParts` in `engine/presentation.ts` + tests; `ui/reports.ts` renders links and combat sites.
- Order banner with Confirm/Cancel and path preview; Undo button + keys; Next ▸ + `N`.
- Browser checks at iPad portrait; before/after screenshots in the PR.
