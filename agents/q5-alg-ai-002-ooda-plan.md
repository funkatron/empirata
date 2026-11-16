# Q5 OODA plan — ALG-AI-002 production slice (2026-11-16)

**Roadmap:** Classic migration step (3) — bounded DOS production policy behind `classic-dos`.

## Observe

- Modern AI owns production heuristics in `modern-executor.ts` (explicitly non-DOS).
- ALG-AI-002 doc: computer pass at turn bookkeeping; unset production must be assigned without UI; inventory counts and grade `62F0` gates ship mix.
- Classic executor only runs ALG-AI-001 movement today.

## Orient

- First PR locks **policy gates** only (army default, transport `<2`, grade-B destroyer when transports exist) — not full `0x3490` tree.
- Use live `Game` unit census + `PlayerView` for defenders; `selectProduction` for mutations.
- Run production pass at start of classic `playAiOpponent` (documented Empirata phase stand-in).

## Decide

PR `cursor/q5-alg-ai-002-85b7`:

- `classic-production.ts` + tests `alg-ai-002-production.test.mjs`
- Wire into `classic-executor.ts` with `selectProduction` dependency

## Act

`npm test` → push → PR.

**Exit:** Classic policy assigns production without modern executor; table-driven tests for army/transport/destroyer gates.