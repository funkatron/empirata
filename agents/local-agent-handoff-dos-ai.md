# Local agent handoff — DOS AI parity (post–v0.6.12 / Q28)

**`main` through v0.6.12** includes Q27 (H1a/H1b) and Q28 (H2–H5): #165–#167, **#168–#171**.

## Done on `main` (movement tranche)

| Item | Status |
|------|--------|
| G1–G3 production + masks + `0x3ADC` | **#161–#163** (v0.6.7–0.6.8) |
| H1a chart `ES:234` passability | **#165** (v0.6.9) |
| H1b rim bearing / `classicResolveLegalDirection` | **#167** (v0.6.10) |
| H2 islands rim regression fixture | **#168** (v0.6.11) |
| H3 `0x4C52` parity doc | **#169** |
| H4 escort `0x4600` close-range | **#170** (v0.6.12) |

See **`agents/q28-post-q27-slices.md`** and **`agents/alg-ai-001-4c52-empirata-parity-2026-11-18.md`**.

## Next work (Q29)

| Slice | Item |
|-------|------|
| **I1** | Escort `1D09:03C2` station ranking (v0.6.13) |
| **I2** | `0x4C52` DOSBox border A/B |
| **I3** | ALG-AI-004 resign bookkeeping |
| **I4** | ALG-012 patrol/wait wake |

Plan: `agents/q29-i1-escort-station-ooda-plan.md`

## Commands

```bash
npm run build && npm test
node --test tests/alg-ai-001-islands-rim-regression.test.mjs
```

## Branch policy

- `cursor/<topic>-85b7` off current `main`
- One slice per PR; preserve AGENTS one-ALG-per-PR where engine behavior changes