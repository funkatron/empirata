# Q7 OODA plan — ALG-AI-001 Random order (2026-11-16)

## Observe

- DOS order **2 (Random)**: `rand()%16==0` rotates direction by unit-index parity bias (`±1`).
- Empirata had no `random` standing order; classic activation only handled `none` + `sentry`.

## Orient

- Add `{ kind: 'random' }` to `UnitOrder` with save validation (Classic/DOS parity).
- Use `nextRandom15` for `% 16`; persist bearing via one-step `go-direction` + restore `random`.
- One move per unit per computer pass.

## Decide

PR `cursor/q7-alg-ai-001-random-85b7`: `classic-order-tick` + executor + `tests/alg-ai-001-random.test.mjs`.

## Act

`npm test` → push → PR.