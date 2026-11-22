# Q31 — multi-track handoff (all parallel workstreams)

**Baseline:** `main` through **v0.6.16** + observer **#181** (2026-11-21).  
**Goal:** Run **four tracks** in parallel without mixing ALGs in one PR. Each row below = one PR unless marked “batch close only.”

**Coordination:** Update `agents/classic-migration-slices.md` when a slice lands. Never push to `main`; branch `cursor/<topic>-85b7`.

---

## Track A — Classic DOS AI parity (engine + traces)

| Slice | Deliverable | Branch hint | Depends on | Evidence gate |
|-------|-------------|-------------|------------|---------------|
| **A1 / J1b** | Escort station **20-angle** probe (`25E6:0F64` + `0x14` loop) or staged stub + ruleset | `cursor/j1b-escort-20angle-85b7` | Static trace **#180** | `alg-ai-001-escort-station.test.mjs`; ruleset row no longer “8-dir only” |
| **A2 / J2** | DOSBox **`0x4C52`** rim A/B per `agents` I2 protocol | `cursor/j2-4c52-dosbox-evidence-85b7` | **#173** doc | Evidence `agents/alg-ai-001-4c52-*.md`; optional fixture only if mismatch |
| **A3 / J3** | ALG-AI-004 **`0xDF58`** crush-order static trace | `cursor/j3-df58-static-trace-85b7` | disasm workflow | New `agents/alg-ai-004-df58-trace-*.md`; ruleset ALG-AI-004 row |

**Read first:** `docs/DOS_ALGORITHM_RULESET.md` (ALG-AI-001 escort station), `agents/alg-ai-001-03c2-static-trace-2026-11-19.md`, `agents/local-agent-trace-workflow.md`.

**Local agent (A1–A3):** `tools/disasm_empire_anchor.py`, DOSBox for A2.  
**Cloud agent:** tests, fixtures after **[D]** is written — do not implement 20-angle without trace cites.

**Suggested order within A:** **A3** (docs-only, parallel) → **A2** (evidence) → **A1** (engine, bump **0.6.17** if behavior changes).

### Track A — paste prompt

```text
Track A — Empirata classic parity. main @ v0.6.16.
Slice: <A1 J1b escort 20-angle | A2 DOSBox 0x4C52 | A3 DF58 static trace>.
Read agents/q31-multi-track-handoff-2026-11-21.md § Track A. One ALG per PR. npm test before push.
```

---

## Track B — ALG-AI-002 production (stale open PRs)

| Step | Action | PRs |
|------|--------|-----|
| **B0** | Triage duplicate branches | Close **#103** if **#105** wins; close **#102** if **#104** wins |
| **B1** | Rebase **#104** `feat/dos-ai-ship-mix-rebased` onto current `main`; fix conflicts | Merge as single ship-mix PR |
| **B2** | Rebase **#105** `feat/dos-ai-visible-inventory-rebased`; run compare CI | Merge after B1 or independently if no overlap |
| **B3** | Held-out / `compare` workflow green on `main` after merges | No new PR — verify only |

**Files likely touched:** `src/engine/ai/classic-production.ts`, planners, `tests/alg-ai-002*.test.mjs`.  
**Do not** combine with Track A escort work in one PR.

**Risk:** **#102** is **CONFLICTING**; do not merge without rebase. **#104/#105** are the preferred rebased heads.

### Track B — paste prompt

```text
Track B — Empirata production AI. Rebase feat/dos-ai-ship-mix-rebased (#104) and
feat/dos-ai-visible-inventory-rebased (#105) onto origin/main. Close obsolete #102/#103.
npm test + compare CI. One merge per PR. See agents/q31-multi-track-handoff-2026-11-21.md § Track B.
```

---

## Track C — Map art, CI, docs housekeeping

| Slice | Deliverable | Open PR | Branch hint |
|-------|-------------|---------|-------------|
| **C1** | Coast / diagonal shoreline (pick one approach) | **#95** vs **#76** | Rebase winner; close loser ( #76 verify failed historically) |
| **C2** | GitHub Actions Node 24 majors | **#96** | Merge if not already on `main`; else close |
| **C3** | Performance / integration doc baseline | **#94** | Doc-only merge |
| **C4** | Optional: verify terrain deploy gate in `WORKSTREAM_STATUS` | new doc PR | `cursor/workstream-status-refresh-85b7` |

**Suggested order:** **C2** (CI) → **C1** (visual + `npm test`) → **C3** → **C4**.

### Track C — paste prompt

```text
Track C — Empirata map/CI/docs. Rebase PR #95 coast fix onto main; retire #76 if superseded.
Check whether #96 Actions Node 24 is already on main. Merge #94 if still accurate.
Browser screenshot for C1. agents/q31-multi-track-handoff-2026-11-21.md § Track C.
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

- [ ] **A:** Ruleset escort row reflects 20-angle **or** explicit staged gap with test; J2/J3 evidence files linked from ruleset  
- [ ] **B:** No open duplicate production PRs; ship-mix + inventory on `main`  
- [ ] **C:** Coast PR resolved; Actions/doc PRs merged or closed with reason  
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