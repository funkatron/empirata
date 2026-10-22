# Empirata Engine Status — v0.2

**Reference:** `Empirata_Classic_Rules_Specification_v0.1.md` (Interstel IBM PC DOS v2.05; August 1988 manual). This document audits implementation coverage. "Pass" means matching the *currently documented* assertion, not executable parity.

| Specification | Engine status | Notes |
|---|---|---|
| IMP-010–012, 014 | Implemented / partial | Grid geometry and terrain; synthetic test map replaces historical `.MAP`. |
| IMP-013, 015, 017 | Deferred | `.MAP` reading, editor, selection, map generation. |
| IMP-020–022 | Implemented / partial | Player rotation, production-first tick on entering faction turn, spent movement. Exact sequencing awaits validation. |
| IMP-023–026 | Partial | Sentry, clear, skip; no autonomous traversal, activation, wait/survey yet. |
| IMP-030–038 | Constants implemented | Eight-unit statistics, half-damage speed, capacities, fuel consumption. Target legality/combat not implemented. |
| IMP-040–044 | Implemented for 50% | Setup vs repeat, change resets progress, coastal restrictions. Non-50 efficiencies intentionally blocked. |
| IMP-045–048 | Partial / deferred | New units created and reported. Overpopulation and capture awaiting verification. |
| IMP-050–055 | Partial / deferred | Non-combat movement, damaged-ship speed, one-step port repair; exchange/bombardment blocked. |
| IMP-060–067 | Partial / deferred | Flyer can refuel in friendly city (timing provisional); embarked transport/patrols blocked. |
| IMP-070–074 | Partial | Faction knowledge, fog, stale sightings. Visibility/detection edge cases need validation. |
| IMP-080–084 | Partial | Canvas keyboard/mouse/touch for manual steps, sentry/skip, event log, selection/production. |
| IMP-090–093 | Deferred | No working AI, hotseat UI or reproducible combat decisions. |
| IMP-100–105 | Implemented foundation | Pure engine separate from renderer; typed commands, seeded PRNG facility, saved files, input handling. |

## Immediate follow-on work: v0.3

1. Obtain and inspect an authentic Interstel **2.05** DOS executable and its map files from an authorized source for behavioral comparison. Do not copy proprietary code or distribute assets.
2. Create reference fixtures from actual combat encounters, documenting initial state, input, RNG uncertainty, and observed results.
3. Add policy modules for combat and city assault only after evidence establishes a behavior (or clearly label a documented approximation that the strict classic mode must not use).
4. Add safe army/transport boarding and carrier interactions against observed sequences.
5. Build first AI **after** sufficient movement and combat systems allow a real game, restricting its inputs to faction-specific `getPlayerView`.

## Special note about programmatic runtime

This is a self-contained static browser build. The code can be opened or modified in any IDE. No server component, database service, accounts, or API keys are necessary. The provided local server is only a static file server.
