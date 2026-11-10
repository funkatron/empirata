# ChatGPT classic-parity implementation pack

Use this when asking ChatGPT (or another coding agent) to port Interstel DOS 2.05C behavior into Empirata. It is a **work brief**, not a substitute for the evidence docs.

## 1. Source of truth (read in this order)

1. [`docs/DOS_ALGORITHM_RULESET.md`](../docs/DOS_ALGORITHM_RULESET.md) — executable formulas, ALG ids, Empirata parity column  
2. [`docs/manual/findings.md`](../docs/manual/findings.md) — short recovered facts + open gaps  
3. [`docs/Empirata_Classic_Rules_Specification_v0.1.md`](../docs/Empirata_Classic_Rules_Specification_v0.1.md) — product intent; **do not override** ALG-* with stale IMP-092 “unverified” AI notes  
4. [`AGENTS.md`](../AGENTS.md) — no engine change without reading rules; feature branch + PR  

Never invent DOS behavior. If an ALG marks something **[?]**, stop and ask — do not guess.

## 2. Hard constraints

- **One ALG (or one ALG-AI) per PR.** Do not mix combat, production, and AI in one change.  
- **Do not replace** the modern/experimental AI in `src/engine/game.ts` (`playRedOpponent`, recon/landing planners). Classic policy goes behind an explicit mode (e.g. `aiPolicy: 'modern' | 'classic-dos'`) or a new module that modern mode never calls.  
- Classic AI may use **only** `getPlayerView` / faction knowledge — same legal actions as a human (IMP-073 / IMP-091).  
- Prefer **behavior tests** over brittle internal structure asserts.  
- `npm test` (and `npm run build` with Node 24) before commit. Feature branch + PR; no direct `main` push.  
- Do not commit private `EMPIRE.EXE` / unpacked images / manual PDF.

## 3. Copy-paste master prompt

```text
You are implementing Empirata classic Interstel 2.05C parity.

Read first:
- docs/DOS_ALGORITHM_RULESET.md (authoritative algorithms)
- agents/classic-parity-chatgpt-pack.md (this pack)
- the Empirata source files named in the task

Task for THIS session only:
- Implement <ALG-XXX or ALG-AI-XXX> exactly as documented.
- Do not change unrelated ALGs or the modern AI path.
- Add/adjust tests that lock the documented behavior.
- Summarize: files changed, formula implemented, tests run, any remaining [?].

Repo rules: feature branch, no secrets/binaries, Node 24 build, npm test.
If the docs are ambiguous, ask — do not invent DOS rules.
```

Fill `<ALG-XXX>` from the checklist below.

## 4. Recommended work order

Do **engine rules** before **classic AI**. AI that calls wrong combat/production will look “broken” even if policy is right.

| Wave | IDs | Goal |
|---|---|---|
| A — correctness | ALG-006, ALG-002, ALG-011, ALG-007 | Production efficiency + cruiser 36; combat `%200` + half-factors; overload destroy survivors; unit cap 1000 |
| B — timing / knowledge | ALG-013, ALG-012, ALG-009 | Dock repair during move/stay; wake set + sub matrix; capture production clear fixture |
| C — classic AI scaffold | ALG-AI-003 | `aiPolicy` / computer grade (`840`∈{1,2}) fields; wire without changing modern default |
| D — classic AI behavior | ALG-AI-002, ALG-AI-001, ALG-AI-004 | Production chooser; order/direction tick + passability; resign offer |
| E — polish | ALG-001 seed schedule, ALG-010 edges | Only if claiming bit-identical campaigns |

## 5. Per-ALG checklist (paste under the master prompt)

### Wave A

**ALG-006 — production times**
- [ ] `requiredProductionTurns` uses first/repeat tables from ALG-006 (cruiser first **36**)
- [ ] `turns = (50 * base) / efficiency` with efficiency 0 → 999 (or documented reject)
- [ ] Default efficiency 50 leaves times unchanged
- [ ] Tests: army first 5@50, cruiser first 36@50, cruiser 18@100, army 10@25

**ALG-002 — unit combat**
- [ ] Hit loop uses `rand15 % 200` vs `atk_eff + def_eff` (and half-factor SARs)
- [ ] Damage from hit table `[1,1,1,1,3,2,1,3]` by type index
- [ ] Ships use remaining HP; army/fighter treated as 1 HP per ALG-002
- [ ] Do not change animation-only `%2` path (ALG-002b)
- [ ] Tests: seed-fixed exchanges vs documented outcomes where possible

**ALG-011 — overload**
- [ ] Surplus cargo destroyed; survivors = first `capacity` live units scanning **high→low** index
- [ ] Tests: overload then assert surviving ids

**ALG-007 — unit cap**
- [ ] Global live+embarked slots capped at **1000**; production halt / message path as documented
- [ ] Test: near-cap placement failure

### Wave B

**ALG-013 — dock / turn order**
- [ ] Ship +1 HP when activated and stay/dock on friendly city (not a separate begin-turn mass repair unless behind compatibility flag)
- [ ] Document Empirata schedule choice if intentionally keeping begin-turn repair

**ALG-012 — detection / wake**
- [ ] Matrix + city observer type `-1` bypass; wake orders sentry **and** patrol/wait if claiming DOS wake parity

**ALG-009 — capture reset**
- [ ] Captured city production cleared to unset; fixture for post-capture assign

### Wave C–D (classic AI)

**Scaffold**
- [ ] New module preferred: e.g. `src/engine/classic-ai.ts` (name flexible)
- [ ] `aiPolicy: 'modern' | 'classic-dos'` (or equivalent); default **modern**
- [ ] Computer grade 1 vs 2 maps to ALG-AI-003 mask / production gates (`62E8`/`62FA` behavior)
- [ ] `playRedOpponent` (modern) unchanged when policy is modern

**ALG-AI-002 — production**
- [ ] End of computer turn (or documented Empirata phase stand-in): assign city production from inventory/coast/threat heuristics
- [ ] No human production prompt for computer cities
- [ ] Tests: fixed view → expected production kind for 2–3 scenarios (early game army/transport; sea-city ship mix)

**ALG-AI-001 — moves**
- [ ] Only legal moves via existing `moveUnit` / `setOrder`
- [ ] Half-HP ships seek repair; Random `rand%16` rotate; pathing uses passability masks (boolean `mask[glyph]`)
- [ ] Do not require bit-identical path trees in v1; lock **policy gates** with tests first

**ALG-AI-004 — resign**
- [ ] Offer only when: computer, one human, two sides left, turn > 100, cities < total/4, not already offered
- [ ] Test: threshold matrix true/false cases

## 6. Fixture stubs (implement as real tests)

Put under `test/` using existing patterns (`*.test.mjs`). Keep seeds and expected values explicit.

```js
// Pseudocode stubs — adapt to Empirata’s test harness.

test('ALG-006 cruiser first at 50% is 36 turns', () => {
  // assert requiredProductionTurns('cruiser', true, 50) === 36
});

test('ALG-006 scales with efficiency', () => {
  // assert requiredProductionTurns('army', true, 100) === 3  // or ceil/floor per ALG-006 idiv
  // assert requiredProductionTurns('army', true, 25) === 10
});

test('ALG-011 overload keeps highest-index survivors up to capacity', () => {
  // build transport at cap+2 cargo; trigger overload; expect survivor ids
});

test('ALG-AI-004 resign predicates', () => {
  // table-driven: {humans:1, sides:2, turn:101, cityShare:0.2, offered:false} => offers
  // turn 100 => no; cityShare 0.25 => no; already offered => no
});

test('classic-dos AI does not run when aiPolicy is modern', () => {
  // spy/module boundary: modern path still playRedOpponent heuristics
});
```

Optional later: DOSBox seed→action traces as JSON fixtures (no binaries in repo).

## 7. Empirata file map

| Area | Start here |
|---|---|
| RNG | `src/engine/rng.ts` |
| Combat / assault | `src/engine/combat.ts`, callers in `game.ts` |
| Production turns | `src/engine/units.ts` (`requiredProductionTurns`), `selectProduction` / `beginTurn` in `game.ts` |
| Knowledge / detection | `src/engine/knowledge.ts` |
| Movement / cargo / fuel | `moveUnit` and helpers in `game.ts` |
| Modern AI (do not clobber) | `playRedOpponent`, `planAiReconLandingSquare`, related helpers in `game.ts` |
| Classic AI (new) | prefer new `src/engine/classic-ai.ts` + thin hook from turn advance |
| Scenarios | `src/engine/scenario.ts`, `advanceLabRound` |

## 8. Done criteria for a classic-AI PR

- [ ] Default gameplay still uses **modern** AI  
- [ ] Classic mode opt-in only  
- [ ] ALG doc parity row updated if behavior landed  
- [ ] Tests cover the ALG acceptance bullets  
- [ ] PR description cites ALG ids and what was **not** attempted  

## 9. What not to ask ChatGPT in one shot

- “Replace Empirata AI with full DOS AI and fix all combat/production”  
- “Match DOS pathfinding byte-for-byte” without fixtures  
- “Implement Standard/Expert by name” without mapping to `840` grades in ALG-AI-003  

Use waves A→D instead.
