# P3 OODA plan (2026-11-16)

Roadmap: [P3 — Documentation accuracy](../docs/ROADMAP.md#p3-documentation-accuracy) (item 7).

## Observe (facts)

### `docs/TEST_STRATEGY.md` (dated 2026-10-23)

| Claim in doc | Actual source (2026-11-16) |
|--------------|----------------------------|
| “Node 22” local coverage | `package.json` engines `>=24 <25`; CI `verify.yml` enforces Node 24 |
| “74 passing tests” | `npm test` reports **432** tests (`tests/*.test.mjs`, 84 files) |
| Line ~92.45% / branch ~88.28% | Latest run: **94.84%** line / **91.47%** branch / **96.48%** func (`dist/engine/*.js`) |
| “Logistics … not implemented yet” | Embark/disembark, carriers, load/unload ship, cargo combat, overload (ALG-011) implemented + tested |
| Sparse AI coverage note | 40+ `ai-*.test.mjs` fixtures; modern AI in `src/engine/ai/`; compare-reconnaissance workflow (nightly + manual since 2026-11-25) |
| Browser / smoke policy | Default CI: `npm test` + `smoke/bundle.mjs` + `smoke/observer-batching.mjs`; UI subset in verify workflow; `test:observer`, map-paint, Playwright flows **opt-in** workflows |
| Coverage gates 85/80% | Unchanged in `package.json` `test:coverage` flags |

### `docs/ENGINE_STATUS.md`

| Area | Drift |
|------|--------|
| Banner | Correctly points to ROADMAP / WORKSTREAM; product **v0.5.1** |
| “Working systems” table | Stale: opponent described as Close Quarters Red only; movement omits much implemented cargo/stacking; saves omit `ai*` fields and `aiPolicy` |
| “Follow-up work” § | Many items done (naval logistics, menus/scenarios, observer, mapgen) — list reads like 2025 backlog |
| Milestone sections (Oct 2026) | Accurate **as history** but embed obsolete CI numbers (122, 139 tests) |
| No pointer | Missing links to `MODERN_AI_UNIT_FIELDS.md`, `DOS_ALGORITHM_RULESET.md`, P0–P2 closures |

### `docs/WORKSTREAM_STATUS.md`

| Item | Note |
|------|------|
| Stream A | Still valid; test count in evidence could cite 432 + Node 24 |
| P2 / doc debt | Roadmap queue still lists P3; no stream for “documentation accuracy” |
| Gates § | Some checkboxes stale (terrain deploy); unrelated to P3 unless we touch evidence column only |

### Repo authority hierarchy (per ROADMAP)

1. `ROADMAP.md` — Current status  
2. `WORKSTREAM_STATUS.md` — parallel streams  
3. `ENGINE_STATUS.md` — **archive**, not priorities  
4. `TEST_STRATEGY.md` — **should** match CI but currently does not  

## Orient (constraints)

1. **P3 is docs-only** — no gameplay, save schema, or coverage threshold changes unless we discover a doc/CI mismatch that requires a one-line script fix (out of scope unless necessary).
2. **Do not delete ENGINE_STATUS milestone narrative** — reconcile by **front-matter + correction table**, not rewriting October logs.
3. **Separate PR** from any future P4 UI work (`ROADMAP.md` item 7).
4. **WORKSTREAM updates only when evidence changes** — after P3 PR merges, one ledger row or footnote for doc stream / test counts.
5. **Run fresh metrics** at implementation time (`npm test` on Node 24); cite commit SHA in updated docs.
6. **OODA habit** — recorded in `AGENTS.md`; this file is the Act precursor for P3.

## Decide (scope and PRs)

### Single PR recommended: `cursor/p3-doc-reconcile-85b7`

| File | Change |
|------|--------|
| `docs/TEST_STRATEGY.md` | Bump date; Node 24; current test count & coverage (with “as of `<sha>`”); logistics + AI sections rewritten to match repo; CI steps aligned with `verify.yml`; optional scripts table (`test:observer`, `evaluate:ai`, held-out workflows) |
| `docs/ENGINE_STATUS.md` | Expand archive banner; add **“Alignment snapshot (2026-11-16)”** subsection: v0.5.1 capabilities checklist, pointer to modern AI docs, explicit “table below is v0.4 snapshot” note on working-systems rows; fix only **factual errors in the summary table** if we keep it (or mark entire table historical) |
| `docs/ROADMAP.md` | Mark P3 closed when PR merges |
| `docs/WORKSTREAM_STATUS.md` | Optional: Stream A evidence “432 engine tests”; add one line under docs debt or new stream “H — Doc accuracy” → **closed** after merge |
| `docs/TECHNICAL_IMPLEMENTATION_PLAN.md` | Only if it still states old test counts in active (non-archive) sections — grep and patch minimal |
| `agents/p3-ooda-plan.md` | This plan (committed with or before implementation PR) |

**Out of scope for P3**

- Rewriting `DOS_ALGORITHM_RULESET.md` statuses  
- Adding automated doc drift tests  
- P4 browser smoke in default CI  
- Merging ENGINE_STATUS into ROADMAP  

### Success criteria

- A new contributor running `npm test` on Node 24 finds **matching** numbers and policy in `TEST_STRATEGY.md`.  
- `ENGINE_STATUS.md` cannot be mistaken for “what to build tomorrow” without reading the banner + snapshot.  
- Roadmap P3 item 7 marked closed.  
- No `npm test` / CI changes required for doc-only PR (verify still green).

## Act (ordered steps)

**Completed 2026-11-16** via PR `cursor/p3-doc-reconcile-85b7`: `TEST_STRATEGY.md`, `ENGINE_STATUS.md` snapshot, `ROADMAP.md` P3 closed, `WORKSTREAM_STATUS.md` evidence refresh.

10. Optional follow-up (P4 / separate): roadmap item 9 browser smoke in CI — **not** part of P3.

## Risks

- **Over-editing ENGINE_STATUS** destroys useful archaeology — prefer additive snapshot.  
- **Coverage % volatility** — cite commit + date, round to 2 decimals, note gates (85/80) unchanged.  
- **Test count growth** — document *how* to read count (`node --test tests/*.test.mjs` via npm script) rather than hard-coding without date.

## OODA reuse

Next queue item after P3: **P4** (map UX audit) — repeat OODA in `agents/p4-ooda-plan.md` before implementation.