# Q2 OODA plan — classic AI scaffold (2026-11-16)

Roadmap follow-on item **2**: policy routing without flipping the playable default.

## Observe

- `AiPolicy` + `classic-grades.ts` (ALG-AI-003) exist; saves reject `classic-dos` as “not yet playable”.
- `playAiOpponent` is hard-wired to `modern-executor.ts`.
- Pack: modern stays default until classic is staged; one module boundary per `agents/classic-parity-chatgpt-pack.md`.

## Orient

- Scaffold = **dispatch + staged classic executor**, not DOS parity moves.
- Allow classic policy in saves for lab tooling; classic turn is explicit no-op + system log.
- Default when `aiPolicy` omitted: `modern-experimental` (unchanged gameplay).

## Decide

PR `cursor/q2-classic-ai-scaffold-85b7`:

- `src/engine/ai/policy.ts` — `resolveAiPolicy`, `defaultAiPolicy`.
- `src/engine/ai/classic-executor.ts` — staged `playAiOpponent` (no unit mutations).
- `game.ts` — route by policy.
- `save.ts` + `tests/ai-policy-save.test.mjs` — classic roundtrip allowed.
- `tests/ai-policy-routing.test.mjs` — modern vs classic boundaries.

## Act

Build, `npm test`, push, PR.

**Exit:** `aiPolicy` is honored at the boundary; classic is labeled staged; modern path bit-identical for legacy saves.