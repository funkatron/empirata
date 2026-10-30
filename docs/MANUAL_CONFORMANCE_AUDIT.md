# Empirata — Interstel 2.05 manual-conformance audit

**Started:** 2026-10-26  
**Status:** Expanded gameplay/strategy reading and selected scan verification (2026-10-30); **not** a completed page-by-page primary-manual verification.

Start with the [manual research reference](manual/README.md), including source hash, reading coverage, strategy and twelve implementation findings. The historical inventory below predates that pass; its uncertainty notes are superseded where explicitly resolved below.

## Evidence standard

The current inventory is grounded in the repository's [Classic Rules Specification v0.1](Empirata_Classic_Rules_Specification_v0.1.md), which cites the *Star Fleet Planetary Task Force Command Manual*, second printing August 1988, for IBM PC Interstel v2.05. The specification is **a secondary research transcription**, not a substitute for checking the original page images. The DOS executable studied elsewhere is identified as **2.05C**, so differences between printed v2.05 and actual 2.05C behavior must be documented rather than silently reconciled.

- **Implemented**: a corresponding code path exists; this does **not** establish fidelity.
- **Covered**: a deterministic test exists; this does **not** establish original-game equivalence.
- **Gap**: absent, incomplete, or not yet traced to a test.
- **Unverified**: manual scan, original executable, or both still require checking.

## Unit inventory — original manual pp. 20–25 (via specification §4)

| Unit | Movement | HP | Damage/hit | First/repeat production | Engine constant | Test |
|---|---:|---:|---:|---|---|---|
| Army | 1 | 1 | 1 | 6 / 5 | `STATS.army` | `manual-unit-roster.test.mjs` |
| Fighter | 5 | 1 | 1 | 12 / 10 | `STATS.fighter` | same |
| Destroyer | 3 | 3 | 1 | 24 / 20 | `STATS.destroyer` | same |
| Troop transport | 2 | 3 | 1 | 30 / 25 | `STATS.transport` | same |
| Submarine | 2 | 2 | 3 | 24 / 20 | `STATS.submarine` | same |
| Cruiser | 2 | 8 | 2 | 35 / 30 | `STATS.cruiser` | same |
| Aircraft carrier | 2 | 8 | 1 | 48 / 40 | `STATS.carrier` | same |
| Battleship | 2 | 12 | 3 | 60 / 50 | `STATS.battleship` | same |

The unit table, fuel constant, half-damage ship movement penalty, and transport/carrier damage-capacity formulas are now covered by deterministic **transcription-conformance** tests. Their successful execution must still be checked in CI. Combat legality and detection differences between unit types are **not** proved by this table.

## Manual rule traceability — first pass

| Spec IDs / manual pages | Rule family | Implementation evidence | Test evidence | Current assessment / next verification |
|---|---|---|---|---|
| IMP-001–003 / 9–20 | 2–3 factions, one initial city, strategic victory/surrender | `types.ts`, `scenario.ts`, `game.ts` | `scenario.test.mjs` | **Gap:** full three-player loop, surrender and victory/end-state |
| IMP-010–017 / 14–17, 58–64 | 100×60 grid, border, eight-way movement, map files/editor | `world.ts`, `scenario.ts` | `core.test.mjs`, `scenario.test.mjs` | **Partial:** historical MAP import/editor and start selection unverified |
| IMP-020–026 / 19, 25, 28, 36 | Turn sequencing, unit activation, Wait/Skip/Sentry, order interrupts | `game.ts`, `types.ts` | `standing-orders.test.mjs`, `regression.test.mjs` | **Partial:** Wait and precise activation/interrupt sequencing require review |
| IMP-030–039 / 19–26 | Unit roster, damage, combat permissions, detection | `units.ts`, `combat.ts`, `knowledge.ts` | `manual-unit-roster.test.mjs`, `adjudication.test.mjs`, `cargo-combat.test.mjs` | **Partial:** roster transcribed; full attack/detection matrix and combat algorithm unverified |
| IMP-040–048 / 12, 25–28, 48–49 | City production, efficiency, saturation, capture/garrison | `game.ts`, `units.ts` | `core.test.mjs`, `regression.test.mjs` | **Gap:** only 50% production supported; overpopulation and exact capture odds unverified |
| IMP-050–055 / 12, 26–28 | Combat exchange, repair, bombardment, ship loss | `combat.ts`, `game.ts` | `adjudication.test.mjs`, `cargo-combat.test.mjs` | **Partial:** exact original RNG/combat exchange unresolved; compare executable |
| IMP-060–067 / 20–21, 38–47, 52 | Loading, unloading, aircraft, patrol, flight paths, escort | `game.ts`, `types.ts` | `transport.test.mjs`, `carrier.test.mjs`, `home-escort.test.mjs`, `ship-orders.test.mjs` | **Gap:** Go Random and city-to-city Flight Paths absent from `UnitOrder`; patrol/fuel nuances unverified |
| IMP-070–074 / 19, 21–26, 42 | Fog of war, sightings, production intelligence | `knowledge.ts`, `game.ts` | `ai-vs-ai.test.mjs`, `hardening.test.mjs` | **Partial:** exact detection and stale-city-intelligence rules require tests |
| IMP-080–084 / 29–53 | Commands, Survey, Group Survey, Activate, reports | `src/ui/main.ts`, `types.ts` | `smoke/bundle.mjs` | **Gap:** command/report completeness and UI keyboard accessibility |
| IMP-090–093 / 9–14 | AI levels, efficiencies, multiplayer | `game.ts`, `types.ts` | `ai-vs-ai.test.mjs` | **Gap:** Standard/Expert and 3-player parity; modern AI intentionally distinct |
| IMP-100–105 / engineering requirements | Persistence, UI/engine separation, reproducibility | `save.ts`, `game.ts`, `src/ui/main.ts` | `regression.test.mjs`, `ai-campaign.test.mjs` | **Engineering contract**, not historical rule evidence |

**Known discrepancy to investigate:** The research specification includes `Go Random` and city-to-city fighter `Flight Paths` (IMP-064, IMP-066, IMP-080), but the current `UnitOrder` union has neither. These are tracked as unimplemented or not yet represented; no unsupported implementation is being invented during this inventory.

## First direct primary-manual cross-check (2026-10-26)

Consulted the publicly available text transcription of the original [Interstel DOS v2.05 manual](https://oldgamesdownload.com/manual/empire-wargame-of-the-century-dos-manual-english/). Its cover identifies IBM PC version 2.05, second printing August 1988. The manual's **Table III (p. 24)** and surrounding unit descriptions support the eight-unit roster, movement, HP and per-hit damage listed above; **Table VII (p. 49)** covers production times. The online OCR merges columns and page order, so the PDF page images still need to be checked before calling each individual value independently scan-verified.

**Strategic implication for the AI roadmap:** The original manual's destroyer description (pp. 21–22) explicitly recommends early destroyers for fast scouting and shoreline/city discovery. Current experimental AI predominantly starts with armies and then transports. This is a documented strategy gap worth testing: build a dedicated destroyer scout and measure useful coast/city discovery versus the current transport-led exploration. This is a *strategy recommendation from the manual*, not a claim that the original computer AI followed that policy.

**Resolved scan detail (2026-10-30):** Printed p. 22 explicitly states that cities can detect submarines. PDF spread 16 was visually inspected. The classic specification now records this; `knowledge.ts:detectedBy` lacks city observers (MF-01). This resolves the manual wording, not independent DOS runtime verification.

## Next audit passes

1. Check each cited page of the actual manual scan, especially unit table, combat/detection exceptions, loading and aircraft rules. Record edition and page references.
2. Build explicit attack-permission and detection matrices for all eight unit types, with tests for each exceptional pairing.
3. Compare production/capture/repair and order semantics against deterministic DOS 2.05C fixtures where the printed manual is ambiguous.
4. Add missing classic commands only after validating their intended behavior, keeping modern AI tactics separate.
5. Reconcile the table above with actual test results and mark each rule **verified**, **discrepant**, or **unresolved**; never equate a passing internal test with historical parity.

**Sources:** [Classic Rules Specification v0.1](Empirata_Classic_Rules_Specification_v0.1.md), especially §4, §12, and its source provenance section; [DOS call-site audit](DOS_CALL_SITE_AUDIT_2026-10-23.md) (RNG unresolved).
