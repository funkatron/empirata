# Local agent handoff — DOS AI parity (post–v0.6.15 / Q30)

**`main`** through **v0.6.15** (#175) plus escort **[T]** ruleset row **#176**.

## Done on `main` (movement tranche)

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

See **`agents/q28-post-q27-slices.md`**, **`agents/q29-i1-escort-station-ooda-plan.md`**.

## Q30 (active)

| Slice | Item |
|-------|------|
| **J0** | Doc / tracker hygiene (this file + `classic-migration-slices.md`) |
| **J1** | `1D09:03C2` eight-direction probe + reachability first-hit — `agents/q30-j1-escort-first-hit-ooda-plan.md` |
| **J2** | (optional) DOSBox `0x4C52` rim run per I2 protocol |
| **J3** | (optional) ALG-AI-004 `0xDF58` crush ordering trace |

## Commands

```bash
npm run build && npm test
node --test tests/alg-ai-001-escort-station.test.mjs tests/alg-ai-001-islands-rim-regression.test.mjs
```

## Branch policy

- `cursor/<topic>-85b7` off current `main`
- One slice per PR; preserve AGENTS one-ALG-per-PR where engine behavior changes