# Local agent handoff — DOS AI parity (post–v0.6.8 / PR #163–#165)

**`main` through v0.6.8** includes merged **[#163](https://github.com/funkatron/empirata/pull/163)** (Raiden `[D]` on top of Q26). **[#162](https://github.com/funkatron/empirata/pull/162)** closed as superseded.

## Done on `main`

| Item | Status |
|------|--------|
| G1 `0x3ADC` stale+fresh slots | **[D] high** (#161) |
| G2 `0x30EB` / `0x3B45` / `0x393A` | **[D]** tree + engine (#163) |
| G3 passability masks @ `0x2E410` | **[D]** in `classic-glyph-masks.ts` + `classicTilePassable` (#163) |
| ALG-AI-003 combat `840` | Wired for `classic-dos` in `combat.ts` (#163) |
| Mask dump tool | `tools/disasm_alg_ai_001_masks.py`, `agents/alg-ai-001-masks-raiden-2026-11-17.txt` |

## Q27 (chart + rim)

| PR | Content |
|----|---------|
| **#165** | H1a chart passability (`classicTilePassableChart`), v0.6.9 |
| **Q27b** | H1b rim bearing (`classicResolveLegalDirection`, rim bias), v0.6.10 — stacks on #165 until merged |

## Next work (priority)

Optional: Raiden trace on `0x4C52`; islands save regression from round-376 JSON; escort `0x4600`.

### Still optional on Raiden

- ALG-AI-004 resign / elimination bookkeeping trace
- ALG-008/013 turn-phase order vs DOS (when AI runs relative to production)

## Commands (repo root)

```bash
npm run build && npm test
node --test tests/alg-ai-001-glyph.test.mjs tests/alg-ai-002-3490-branches.test.mjs
```

## Branch policy

- `cursor/<topic>-85b7` off current `main`
- Do not commit unpacked binaries
- Open PR; merge only when asked