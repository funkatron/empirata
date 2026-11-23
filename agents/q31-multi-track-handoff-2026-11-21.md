# Q31 — multi-track handoff (all parallel workstreams)

**Baseline:** `main` through **v0.6.16** + observer **#181** (2026-11-21).  
**Goal:** Run **four tracks** in parallel without mixing ALGs in one PR. Each row below = one PR unless marked “batch close only.”

**Coordination:** Update `agents/classic-migration-slices.md` when a slice lands. Never push to `main`; branch `cursor/<topic>-85b7`.

---

## Track A — Classic DOS AI parity (engine + traces)

| Slice | Deliverable | Branch hint | Depends on | Evidence gate |
|-------|-------------|-------------|------------|---------------|
| **A1 / J1b** | **Done (v0.6.17).** 20 probes, two `rand()` draws, `idiv (2n+1)`, `n=3`. One roll per activation. | `agents/alg-ai-001-03c2-rand-tile-2026-11-23.md` | Trace **[D]** | `alg-ai-001-escort-station.test.mjs` |
| **A2 / J2** | DOSBox **`0x4C52`** rim A/B per `agents` I2 protocol | `cursor/j2-4c52-dosbox-evidence-85b7` | **#173** doc | Evidence `agents/alg-ai-001-4c52-*.md`; optional fixture only if mismatch |
| **A3 / J3** | ALG-AI-004 **`0xDF58`** crush-order static trace | `cursor/j3-df58-static-trace-85b7` | disasm workflow | New `agents/alg-ai-004-df58-trace-*.md`; ruleset ALG-AI-004 row |

**Read first:** `docs/DOS_ALGORITHM_RULESET.md` (ALG-AI-001 escort station), `agents/alg-ai-001-03c2-static-trace-2026-11-19.md`, `agents/local-agent-trace-workflow.md`.

**Local agent (A1–A3):** `tools/disasm_empire_anchor.py`, DOSBox for A2.  
**Cloud agent:** tests, fixtures after **[D]** is written — do not implement 20-angle without trace cites.

**Suggested order within A:** **A1** is implemented. Next: **A3** (`0xDF58` trace) and **A2** (DOSBox `0x4C52`). The `n=10` caller at `0x1D39F` is a separate slice.

### Track A — paste prompt

```text
Track A — Empirata classic parity. main @ v0.6.16.
Slice: <A1 J1b escort 20-angle | A2 DOSBox 0x4C52 | A3 DF58 static trace>.
Read agents/q31-multi-track-handoff-2026-11-21.md § Track A. One ALG per PR. npm test before push.
```

---

## Track B — ALG-AI-002 production (landed)

| Step | Action | PRs |
|------|--------|-----|
| **B0** | Triage duplicate branches | **done** — duplicates closed; do not reopen |
| **B1** | Ship-mix policy | **done** — **#104** on `main` |
| **B2** | Own-unit inventory from `PlayerView` | **done** — **#184** on `main` (`src/engine/ai/dos-production.ts`) |
| **B3** | Held-out / `compare` workflow green on `main` after merges | optional verify only — not a new feature |

**Landed in** `src/engine/ai/dos-production.ts` and `tests/alg-ai-002-ship-mix.test.mjs`, `tests/alg-ai-002-inventory.test.mjs`.  
Do not open a new ship-mix or inventory PR. A later production ALG is a new slice, not a rebase of #104 or #184.

### Track B — paste prompt

```text
Track B is done on main (#104 ship-mix, #184 inventory). Do not rebase or reopen it.
Next classic work is Track A. See agents/q31-multi-track-handoff-2026-11-21.md.
```

---

## Track C — Map art, CI, docs housekeeping

| Slice | Deliverable | Open PR | Branch hint |
|-------|-------------|---------|-------------|
| **C1** | Coast / diagonal shoreline | **done** (#76, #95) | Do not reopen coastline PRs |
| **C2** | GitHub Actions Node 24 majors | **done** (#96) | — |
| **C3** | Performance / integration doc baseline | **done** (#94) | `docs/PERFORMANCE_AI_INTEGRATION.md` |
| **C4** | Optional: `WORKSTREAM_STATUS` date refresh | pending | `cursor/workstream-status-refresh-85b7` |

**C1–C3 are on `main`.** Only optional **C4** remains.

### Track C — paste prompt

```text
Track C coastline, Actions Node 24, and the performance baseline are already on main.
Do not reopen #76, #94, #95, or #96. Optional leftover: refresh docs/WORKSTREAM_STATUS.md (C4).
```

---

## Track D — Observer / CvC UI polish

| Slice | Deliverable | Scope | Notes |
|-------|-------------|-------|-------|
| **D1** | Order paths in **human lab** scenarios (optional) | `src/ui/main.ts` | Today `paintOrderOverlays` returns unless `ai-vs-ai`; gate with same toggle |
| **D2** | Path refresh on selection change without waiting for paint cache key | `main.ts` | Invalidate `pathOverlayKey` in `tapTile` / stack `select()` |
| **D3** | Discoverability: spectator note or default-on destinations in dev | `public/index.html` | Spatial stability — checkbox position fixed |
| **D4** | Smoke: optional Playwright assert path stroke when fixture has move order | `smoke/observer.mjs` | Only if stable fixture added |

**Depends on:** **#181** on `main` (done). **No engine change** unless D1 needs export only.

**Suggested order:** **D2** (small) → **D3** → **D1** → **D4**.

### Track D — paste prompt

```text
Track D — Empirata observer UI post-#181. Slice <D1–D4> from agents/q31-multi-track-handoff-2026-11-21.md.
Edit src/ + public/. computerUse or smoke for CvC. No sidebar roundProgress regression.
```

---

## Parallelization matrix

| Can run same week | Cannot combine in one PR |
|-------------------|---------------------------|
| A3 + C3 + C4 (docs) | A1 + B1 |
| B1 then B2 (serial if same files) | A1 + D1 if both touch `classic-escort` + UI heavily |
| D2 + C2 | B* + A1 (production + escort) |
| A2 local DOSBox while cloud runs B rebase | |

**Agents:** up to **4 cloud agents** = one per track after B0 triage; **local machine** owns Track A traces (A2, A3 disasm; optional DOSBox for A2).

---

## Definition of done (Q31 tranche)

- [x] **A1:** `1D09:03C2` random window is in the engine (v0.6.17), one probe per activation. **A2/A3** evidence still open.  
- [x] **B:** Ship-mix **#104** and inventory **#184** on `main`  
- [x] **C:** Coast **#76/#95**, Actions **#96**, and performance doc **#94** on `main` (optional `WORKSTREAM_STATUS` refresh remains)  
- [ ] **D:** At least **D2** shipped; D1/D4 if time  
- [ ] **Hygiene:** `local-agent-handoff-dos-ai.md` + slice tracker list Q31 rows **done/pending**

---

## Quick commands

```bash
git fetch origin main && git checkout -b cursor/<topic>-85b7 origin/main
npm run build && npm test
node --test tests/alg-ai-001-escort-station.test.mjs
```

**Live UI:** Computer vs computer → **Show order destinations** → select unit with a standing move order → path on map; busy spinner bottom-right during Advance.