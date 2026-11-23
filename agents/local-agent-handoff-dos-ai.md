# Local agent handoff — DOS AI parity (post–v0.6.16 / Q31)

**`main`** through **v0.6.16** (#178) + Q30 traces (#177–#180) + observer **#181**.

## Done on `main` (movement + Q30 + observer)

| Item | Status |
|------|--------|
| G1–G3 production + masks + `0x3ADC` | **#161–#163** (v0.6.7–0.6.8) |
| H1a chart `ES:234` passability | **#165** (v0.6.9) |
| H1b rim bearing / `classicResolveLegalDirection` | **#167** (v0.6.10) |
| H2 islands rim regression fixture | **#168** (v0.6.11) |
| H3 `0x4C52` parity doc | **#169** |
| H4 escort `0x4600` close-range | **#170** (v0.6.12) |
| I1 escort station **[T]** rank | **#172** (v0.6.13) |
| I2 `0x4C52` DOSBox protocol | **#173** (doc) |
| I3 ALG-AI-004 resign doc | **#174** (v0.6.14) |
| I4 ALG-012 wake set | **#175** (v0.6.15) |
| I1b escort station [T] ruleset | **#176** |
| J0 Q30 handoff / tracker | **#177** |
| J1 escort 8-dir + `006C` first-hit | **#178** (v0.6.16) |
| J1 static trace (20-angle vs 8-dir) | **#179–#180** |
| Observer order overlays + `#mapBusy` | **#181** |

See **`agents/q28-post-q27-slices.md`**, **`agents/q29-i1-escort-station-ooda-plan.md`**, **`agents/q30-j1-escort-first-hit-ooda-plan.md`**.

## Q31 (active — all tracks)

**Master plan:** **`agents/q31-multi-track-handoff-2026-11-21.md`**

| Track | Focus |
|-------|--------|
| **A** | A1 done (v0.6.17 random window); J2 DOSBox `0x4C52`; J3 `0xDF58` trace |
| **B** | **done** — ship-mix **#104**, inventory **#184** |
| **C** | **done** except optional workstream refresh — coast **#76/#95**, CI **#96**, docs **#94** |
| **D** | Observer path polish (human lab paths, cache invalidation, smoke) |

## Local traces vs cloud GUI

- **Your local agent (terminal):** binary/DOSBox traces — **`agents/local-agent-trace-workflow.md`**, `tools/disasm_empire_anchor.py`.
- **Cloud agent:** `npm test`, fixtures, browser smoke — not a substitute for DOSBox on rim/escort.

## Commands

```bash
npm run build && npm test
node --test tests/alg-ai-001-escort-station.test.mjs tests/alg-ai-001-islands-rim-regression.test.mjs
```

## Branch policy

- `cursor/<topic>-85b7` off current `main`
- One slice per PR; preserve AGENTS one-ALG-per-PR where engine behavior changes