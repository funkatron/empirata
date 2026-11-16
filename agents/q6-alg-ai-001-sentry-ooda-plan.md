# Q6 OODA plan — ALG-AI-001 sentry + half-HP go-home (2026-11-16)

**Stacks after:** merged #132 (ALG-AI-002 + ALG-AI-001 none bearing).

## Observe

- ALG-AI-001 doc: sentry engage adjacent contacts; ships at half HP with empty transport cargo seek repair (`0x3D10`).
- Classic executor only applied order-none bearing.

## Orient

- One computer activation step per unit (pass limit 1).
- Reuse `moveUnit`, `setOrder`, `routeStep` — no hidden knowledge.
- Sentry engage uses fresh adjacent enemies from `PlayerView`.

## Decide

PR `cursor/q6-alg-ai-001-sentry-85b7`:

- Extend `classic-order-tick.ts` + `classic-move.ts`
- Tests `alg-ai-001-sentry-gohome.test.mjs`

## Act

`npm test` → push → PR.

**Exit:** Classic policy sentry fights adjacent contacts; damaged empty transports head homeward one step.