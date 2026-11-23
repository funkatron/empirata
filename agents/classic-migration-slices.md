# Classic migration — slice tracker (2026-11-23)

Authoritative **order** for post–v0.5.2 classic work. Update status as PRs land.

| Slice | Deliverable | Status |
|-------|-------------|--------|
| **A** | Doc reconcile: ALG §2 mapping, TEST_STRATEGY 483 tests, roadmap dates | done (Q15) |
| **B** | Campaign **AI policy + grade** UI (ALG-AI-003 selectors, saves) | done (Q14 → v0.5.3) |
| **C** | ALG-AI-001 depth: escort/load, glyph passability, ship set B | done (Q16 → v0.5.4) |
| **D** | ALG-AI-002 threat / `0x3ADC` reachability refinements | done (Q17 → v0.5.6) |
| **E** | Default opponent = Classic DOS when staged complete | done (Q18 → v0.6.0) |
| **F1** | Spectator Blue+Red intel + classic land conquest | done (v0.6.3 / v0.6.6) |
| **F2** | Classic offshore sealift | done (Q19 → v0.6.4) |
| **F3** | ALG-AI-001 `0x4462` move-to reissue | done (Q20 → v0.6.5) |
| **F4** | Held-out capture eval + P4 doc pointers | done (Q21–Q22) |
| **F5** | Slice F documentation reconcile | done (Q23) |
| **G1** | ALG-AI-002 `0x3ADC` stale+fresh slots | done (v0.6.7, Raiden **[D] high**) |
| **G2** | ALG-AI-002 `0x30EB` / `0x3B45` / `0x393A` | done (v0.6.8, Q26 + #163 Raiden **[D]**) |
| **G3** | ALG-AI-001 mask bytes @ `0x2E410` in engine | done (#163) |
| **H1a** | ALG-AI-001 chart `ES:234` pathfinding | done (v0.6.9, Q27a) |
| **H1b** | Map-rim stuck ships (`none` / wander) | done (v0.6.10, Q27b) |
| **H2** | Islands seed `3898486421` round-376 rim regression | done (v0.6.11, Q28 #168) |
| **H3** | ALG-AI-001 `0x4C52` parity documentation | done (Q28 #169) |
| **H4** | Escort close-range `0x4600` | done (v0.6.12, Q28 #170) |
| **H5** | Post-Q27 handoff doc hygiene | done (Q28 #171) |
| **I1** | Escort stationing `1D09:03C2` | done (v0.6.13, Q29 #172) |
| **I2** | `0x4C52` DOSBox border A/B | done (#173) |
| **I3** | ALG-AI-004 resign bookkeeping trace | done (v0.6.14, #174) |
| **I4** | ALG-012 patrol/wait wake | done (v0.6.15, #175) |
| **I1b** | Escort station sort [T] ruleset honesty | done (#176) |
| **J0** | Q30 handoff + slice tracker post–#176 | done (Q30) |
| **J1** | Escort `1D09:03C2` eight-dir + `006C` first-hit | done (v0.6.16, Q30) |
| **J-trace** | Static trace `03C2` 20-angle vs 8-dir | done (#180) |
| **J-UI** | CvC order paths, `#mapBusy`, drop `roundProgress` | done (#181) |

## Q31 (open — see `agents/q31-multi-track-handoff-2026-11-21.md`)

| Slice | Deliverable | Status |
|-------|-------------|--------|
| **J1b / A1** | Escort station 20-iteration loop | staged — `25E6:0F64` is ALG-001 `rand()`; tile conversion **[?]**; engine stays 8-dir (`agents/q31-a1-escort-station-staged.md`) |
| **J2 / A2** | DOSBox `0x4C52` rim evidence | pending |
| **J3 / A3** | ALG-AI-004 `0xDF58` static trace | pending |
| **B1** | DOS production ship-mix | done (#104) |
| **B2** | DOS production own-unit inventory (`PlayerView`) | done (#184) |
| **C1** | Diagonal shoreline / shared sea atlas | done (#76, #95) |
| **C2** | GitHub Actions Node 24 majors | done (#96) |
| **C3** | Performance integration baseline | done (#94) |
| **C4** | `WORKSTREAM_STATUS` refresh | pending (optional) |
| **D1–D4** | Observer path polish | pending |

**Policy:** patch semver (0.5.x) for shipped UI/behavior; **0.6.0** minor when classic became default (slice E). Further 0.6.x patches through 0.6.x classic expansion (F).