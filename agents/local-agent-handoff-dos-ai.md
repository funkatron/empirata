# Local agent handoff — DOS AI parity (2026-11-17)

Use this after cloud merge of **Q26** (`cursor/q26-alg-ai-002-30eb-85b7`). Run on **Raiden** or any machine with the unpacked `EMPIRE` flat image.

## Done on main (through v0.6.8)

| Item | Status |
|------|--------|
| G1 `0x3ADC` stale+fresh slots | **[D] high** (PR #161) |
| `0x30EB` inventory | `classicInventoryBlock0x30EB` via `PlayerView.ownUnits`; per-city refresh in classic executor (high→low city id) |
| `0x3B45` / `0x393A` | Staged helpers + chooser hooks; `0x393A` gated on **no navy** until static proof of tree order |
| ALG-AI-001 glyph helper | `classic-glyph.ts` city code + `tools/disasm_alg_ai_001_masks.py` |
| Docs | G1 done in slice tracker; README **0.6.8** |

## Your next jobs (priority)

### 1. `0x393A` call-site order (binary)

**Question:** Does `0x393A` run before or after navy branches (`transport<2`, grade-B destroyer, `0x3ADC`) when `cityCount<=1` and fighters=0 but transports already exist?

**How:** Disasm around image `0x393A`…`0x39A9` in the `0x3490` tree; compare against `chooseClassicCityProduction` in `src/engine/ai/classic-production.ts`.

**Deliverable:** One paragraph in `docs/DOS_ALGORITHM_RULESET.md` + adjust `classicEarlyProduction0x393A` guard if needed.

### 2. Full 34-byte glyph masks → Empirata

**Tool:**
```bash
python3 tools/disasm_alg_ai_001_masks.py \
  --image "$HOME/private/interstel/EMPIRE_UNPACKED_IMAGE.bin" \
  --report /tmp/alg-ai-001-masks.txt
```

**Goal:** Generate `src/engine/ai/classic-glyph-masks.ts` (or JSON under `agents/`) with nonzero indices per profile; wire `classicTilePassable` to chart glyph + mask byte test per `0x1ACE0`.

**Evidence tag:** Promote ALG-AI-001 parity row only with **[D]** dump attached in `agents/`.

### 3. `0x30EB` recount timing

**Question:** On production type change, does DOS increment inventory optimistically or only recount live units?

**How:** Trace callers of `0x30EB` from `0x3490` (type change path). If only live recount, Empirata is done; if optimistic, mirror in executor after `selectProduction`.

### 4. Remaining ALG-AI-002 gaps

After (1): trace **`0x3B45`** full coastal `cityCount/2` else-army fall-through vs ship-mix (`0x39A9`). One PR per ALG per `AGENTS.md`.

### 5. ALG-AI-003 combat `840` factors

Wire `classic-grades.ts` combat factor into `combat.ts` / efficiency rolls when `aiPolicy.kind === 'classic-dos'`.

## Commands (repo root)

```bash
npm run build
npm test
node --test tests/alg-ai-002-3490-branches.test.mjs tests/alg-ai-001-glyph.test.mjs
node --test tests/alg-ai-002-3adc-threat.test.mjs
```

## Branch policy

- Branch: `cursor/<topic>-85b7`
- Do not commit unpacked binaries or PDFs
- Merge only when user asks; open PR with `gh pr create` after push