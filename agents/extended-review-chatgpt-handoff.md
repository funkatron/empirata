# ChatGPT handoff — Empirata extended project review (2026-11-12)

Paste this brief into ChatGPT (or another coding agent) when continuing Empirata work after the 2026-11-12 extended review. It is a **work brief**, not a substitute for reading current source and evidence docs.

**Review baseline:** `origin/main` as of 2026-11-12 (includes #93 city names, #92 UI snappiness, #84 DOS Wave A parity, Node 24 Actions #97).  
**Policy update after review:** #98 prioritizes **classic DOS AI as the intended default**; modern AI remains a selectable experimental difficulty with **strategic development frozen**. Do not switch gameplay to an incomplete classic AI without a clearly marked staged implementation.  
**Local verification that day:** `npm test` → **408/408 pass**; engine coverage ≈ **95.9% lines / 95.3% branches** (gates 85/80).  
**Live site:** https://funkatron.github.io/empirata/  
**Current package version:** `0.4.0` (UI brand still shows **v0.4**).

Related packs: [`classic-parity-chatgpt-pack.md`](classic-parity-chatgpt-pack.md) · [`AGENTS.md`](../AGENTS.md) · [`docs/ROADMAP.md`](../docs/ROADMAP.md) · [`docs/WORKSTREAM_STATUS.md`](../docs/WORKSTREAM_STATUS.md)

---

## 1. Copy-paste master prompt

```text
You are continuing Empirata (Interstel Empire DOS 2.05 / 2.05C classic-rules lab).

Read first:
- agents/extended-review-chatgpt-handoff.md (this brief)
- AGENTS.md
- For classic parity: agents/classic-parity-chatgpt-pack.md + docs/DOS_ALGORITHM_RULESET.md
- For AI strategy: docs/STRATEGY_AND_TACTICS_PLAN.md (do not treat landings as success)

Hard rules:
- Edit src/ and public/ only for app code. Do not commit generated dist/ or root standalone index.html as source patches.
- Feature branch + PR; never push straight to main. Merge only when asked.
- Node 24: npm run build && npm test before claiming engine work done. UI needs browser evidence.
- One bounded change per PR. Do not mix classic DOS rules, modern AI tuning, and UI redesign.
- Prioritize classic DOS AI as the intended default (`aiPolicy` / separate module). Keep modern AI as a selectable experimental difficulty; freeze its strategic development. Shared engine rules and performance work may serve both. Do not flip gameplay to incomplete classic AI without a staged, clearly marked implementation.
- Never invent DOS behavior. If docs say [?], ask.
- Iterate semantic version when a coherent milestone ships (see §8). Do not leave the product stuck on 0.4 forever after meaningful player/engine milestones land.

Task for THIS session only:
- <fill: one bounded goal from §7 recommended sequence>
- Summarize: files changed, why, tests/build run, semver impact (none / patch / minor), remaining risks.

If status docs disagree with source + alg-*.test.mjs, trust source/tests and refresh docs — do not re-implement Wave A.
```

---

## 2. Project verdict (honest)

Empirata is a **serious mid-stage rules laboratory** with a playable Close Quarters skirmish, CvC observer, recovered DOS RNG/combat/production pieces, transport/carrier logistics, and a knowledge-limited **modern** AI. It is **not** a finished classic-compatible release and **not** original Interstel AI parity.

| Layer | Reality |
|---|---|
| Core loop | Strong: move, fog, produce, combat, capture, cargo, saves, CvC |
| DOS Wave A (#84) | Largely **landed in code + alg tests**; several status docs still say “differs/unimplemented” |
| Modern AI | Early/diagnostic; 42-campaign baseline had **0 eliminations** |
| Classic DOS AI | Documented (`ALG-AI-*`); **not implemented** in engine |
| Classic completeness | Partial: no MAP import, 3-player, resign, Go Random/Flight Paths; saves lock efficiency at 50 |
| UI | Lab-ready; `main.ts` monolithic; browser CI mostly opt-in |

**Biggest immediate risk:** documentation lag after #84 → agents re-open finished work or “fix” already-landed items.  
**Biggest engineering risk:** `src/engine/game.ts` (~1677 lines) owns rules API **and** almost all modern AI.

---

## 3. Architecture map (keep dual tracks separate)

```
types, units, world, rng
knowledge (fog / PlayerView contract — UI and AI must use this)
combat → adjudication (+ cargo-overload)
game.ts          ← hotspot: movement, production, orders, turns, ALL modern AI
scenario, save, presentation, unit-names
ui/main.ts       ← hotspot: shell, paint, menus, CvC playback
```

**Dual-track rule (non-negotiable; updated by #98):**

1. **Classic rules / ALG-* ** — fidelity to Interstel 2.05C evidence.  
2. **Classic DOS AI (`classic-dos`)** — **intended default** once staged implementation is ready; build behind `aiPolicy` / a dedicated module; use only `PlayerView`.  
3. **Modern experimental AI** — keep selectable; **freeze strategic development**; may share engine rules and performance work; must not claim DOS AI parity.

Do not mix tracks in one PR. Do not delete modern AI while classic is incomplete.

---

## 4. Critical findings (act on these)

### F1 — Doc/code drift after #84 (process P0)

Trust **source + `tests/alg-*.test.mjs`**, not stale parity columns:

| Topic | Code reality (verify in tree) | Stale doc tendency |
|---|---|---|
| Combat | `%200` threshold + SAR half-factors | “differs” / old 50/50-only story |
| Production | cruiser first **36**; `(50*base)/efficiency` | cruiser **35**; “efficiency unimplemented” |
| Overload | destroy surplus; ALG-011 survivors | “rejects overloaded” / differs |
| Unit cap | 1000 slot halt | unimplemented |
| Game RNG | Microsoft C LCG in `rng.ts` | ENGINE_STATUS still mentions xorshift for game RNG (map gen may still use local xorshift) |
| Logistics | transport/carrier implemented + tested | footer/toast and some status bullets still “under development” |

Also refresh: classic-parity pack Wave A checklists, Classic Spec / conformance audit unit tables, `TEST_STRATEGY.md` (Node 24, logistics present), `ENGINE_STATUS.md` working-systems table, `manual/findings.md` present-tense MF rows.

### F2 — `game.ts` god module

Roadmap P1: extract `planAi*` / planners into `src/engine/ai/` with **no intentional behavior change**; optional later extract of `playAiOpponent` executor. Planners return intentions; engine applies legal actions only via existing APIs.

### F3 — Build artifact drift

`.gitignore` does not ignore `dist/`. Git tracks a partial older subset; local builds create untracked modules. **Never** commit `dist/` or generated root `index.html` as source patches. CI builds the Pages artifact from the just-built single-file bundle.

### F4 — Stale ops / product copy

- `DEPLOYMENT.md` may still reference non-existent `pages.yml` (deploy is in `verify.yml`).  
- Footer toast may still claim troop loading under development.  
- README “New skirmish” vs Game menu labels (`Close Quarters`, etc.).

### F5 — Roadmap overload / P0 clarity

P0 lost-port / post-capture production: engine tests advanced (#88/#89 area); WORKSTREAM F may still say Open without residual matrix. Reclassify with evidence (engine vs browser vs DOS call-order) before more strategy tuning.

### F6 — UI confidence thinner than engine

Engine coverage gated; UI relies on structure/smoke. Focused CI for display-only PRs; consider keeping `observer-map` tests in focused UI scope. Real Playwright mostly opt-in.

### F7 — Strategy baseline hygiene

Frozen 42-campaign archive must not be mutated. After material rules changes (#84), treat old baseline as historical unless a deliberate re-baseline is authorized. Held-out full eval needs smoke artifact + resumable shards before another 72-run.

---

## 5. What is already strong (do not “rediscover”)

- Evidence tagging culture (`[M]/[D]`…, ALG ids, manual Scan/Text/Code).  
- Combat/adjudication split; fog via `getPlayerView`; no omniscient AI routing.  
- ALG regression suites: `alg-002`, `006`, `007`, `011`, `012`, `013`.  
- CI: Node 24, scoped verify, smoke on single-file bundle, deploy only after verify on `main`.  
- Evaluation discipline: small seeded fixtures for PRs; long campaigns opt-in only.

---

## 6. Open classic surface (after docs catch up)

Still incomplete vs “classic-compatible”:

- Standing orders: Go Random, Flight Paths; escort geometry; Go Home + carrier-as-home; carrier-relative patrol.  
- Efficiencies end-to-end in play/saves (formula exists; types/saves often lock 50).  
- City assault RNG bit-family vs ALG-004 schedule.  
- MAP import, 3-player, resign/victory UX, setup grades.  
- Classic AI Waves C–D (`aiPolicy`, production chooser, order tick, resign).

---

## 7. Recommended work sequence (one PR at a time)

Approve with the human before implementing. Prefer this order unless they redirect:

| Step | PR type | Goal | Semver hint |
|---|---|---|---|
| 1 | **docs-only** | Refresh ALG §2 mapping, Wave A “done”, cruiser 36, ENGINE_STATUS/TEST_STRATEGY, findings crosswalk | usually **none** (or patch if packaging a dated review release) |
| 2 | **docs/ops** | Fix DEPLOYMENT.md, product toast/README labels; gitignore `dist/` + stop tracking stale build outputs | **patch** if release notes care; else none |
| 3 | **engine refactor** | Extract `src/engine/ai/` (behavior-preserving) | **patch** (internal) unless bundled with a named milestone |
| 4 | **P0 residual** | Evidence checklist + any real remaining lost-port/inspector gaps | **patch** |
| 5 | **classic rules** | MF standing-order gaps or ALG-004 assault parity — one ALG/MF cluster per PR | **minor** if player-visible classic commands land |
| 6 | **classic AI scaffold** | Add `aiPolicy` / classic module; keep **current modern path as interim default** until classic is staged-complete enough to flip; mark stages clearly | **minor** when mode is selectable |
| 7 | **classic AI behavior** | ALG-AI production/orders/resign — one ALG-AI per PR; freeze further modern strategy work | **minor** per usable classic milestone |
| 8 | **UI / snappiness** | Fit-world residuals, browser smoke, paint invalidation — separate from rules | **minor** when UX milestone is user-facing |

Do **not** flip the product default to classic AI until a staged implementation is clearly marked complete enough. Do **not** resume modern AI strategic tuning (#98 freeze). Prefer docs honesty + `game.ts` AI extraction before large classic-AI behavior PRs.

---

## 8. Semantic version iteration (required process)

**Policy:** Empirata must **keep iterating its semantic version** as coherent milestones ship. Do not leave `package.json` and UI brand stuck at **0.4 / 0.4.0** after substantial engine, logistics, parity, or UX milestones have already landed on `main`.

### Current state

- `package.json` / lockfile: **0.4.0**  
- UI chrome (`public/index.html` title/brand): **v0.4**  
- README narrates “Version 0.4 — First genuinely interactive skirmish”

### When to bump

| Bump | Use when |
|---|---|
| **None** | Pure docs, CI chore, comment-only, failed experiment abandoned |
| **patch** (`0.4.x` → `0.4.x+1`) | Bugfix, doc/ops hygiene packaged as a release, behavior-preserving refactors, test-only hardening that ships |
| **minor** (`0.4.0` → `0.5.0`) | Player-visible capability: logistics declared done, classic command set chunk, CvC/observer milestone, Wave A parity “called” as a release, meaningful UI navigation milestone |
| **major** (`1.0.0`) | Only with explicit human approval when classic-rules completeness + product readiness are intentionally claimed |

Pre-1.0, prefer **minor** for user-visible milestones and **patch** for fixes. Still bump — do not accumulate unbounded unversioned change on `0.4.0`.

### What to update together in a version PR (or the milestone PR)

1. `package.json` + `package-lock.json` `version`  
2. `public/index.html` title and brand small text (`v0.X`)  
3. README version headline / “what’s new” paragraph for that milestone  
4. Optional: short note in `docs/ENGINE_STATUS.md` or ROADMAP “shipped as 0.x.y”

Do **not** bump version inside unrelated drive-by commits. Prefer either:

- a **dedicated `chore/release-0.x.y` PR**, or  
- the **final PR of a named milestone** that explicitly includes the bump.

### Agent checklist for every milestone PR

- [ ] Did this change warrant a semver bump? If yes, which level?  
- [ ] If bumping: package + UI brand + README aligned?  
- [ ] Changelog-style PR summary states old → new version?  
- [ ] No claim of DOS bit-identical campaigns unless Wave E evidence exists  

---

## 9. Repo / CI constraints for agents

- Node **24** (`engines`, `.nvmrc`).  
- Display-only paths (`docs/**`, `agents/*.md`, `src/ui/**`, `public/**`, …) → **focused** verify (build + small UI tests + smoke), not full engine coverage.  
- Engine/`package.json`/workflow changes → **full** `npm test` + coverage gates.  
- Do not commit private `EMPIRE.EXE`, unpacked images, or manual PDFs.  
- Long campaigns / held-out eval: follow `agents/evaluation/EXECUTION_POLICY.md` — never default CI.

---

## 10. Suggested first messages to ChatGPT

**A — Docs reconcile (no gameplay)**  
“Using `agents/extended-review-chatgpt-handoff.md`, produce a docs-only PR plan that refreshes ALG mapping / Wave A status / cruiser 36 / ENGINE_STATUS + TEST_STRATEGY against current `src/` and `tests/alg-*.test.mjs`. No code changes. Call out every stale claim you will edit.”

**B — AI extract**  
“Plan (then implement only after approval) extracting modern AI planners from `game.ts` into `src/engine/ai/` with zero intentional behavior change. List modules, public exports, and which tests must stay green. Semver: patch unless we bundle a named 0.5 milestone.”

**C — Semver catch-up**  
“Propose the next Empirata semver (0.4.1 vs 0.5.0) given #84 logistics/parity and #92 snappiness already on main. List every file that must change for a coherent bump and draft README ‘what’s new’ copy. Do not bump without approval.”

---

## 11. Explicit non-goals for this handoff

- Do not mutate the frozen 42-campaign baseline.  
- Do not “fix” Wave A algorithms that already have passing `alg-*.test.mjs` without first proving a real regression.  
- Do not resume modern AI strategic development (#98 freeze); keep it selectable/experimental only.  
- Do not switch gameplay default to incomplete classic AI without a staged, labeled implementation.  
- Do not treat a single invasion fixture pass as general strategy strength.  
- Do not commit `dist/` drift from local builds.

---

## 12. Review provenance

Extended review performed 2026-11-12 in Cursor (engine, UI/tests/CI, and docs/parity parallel passes), synthesized for ChatGPT continuation. Findings are **review judgments and process recommendations**, not automatic proof of new engine defects. Always re-read current `main` before implementing.
