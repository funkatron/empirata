# Q4 OODA plan — recon / idle transport fixture (2026-11-16)

Roadmap follow-on item **4**: bounded fixture for idle transport reassignment (#50 lineage).

## Observe

- `scripts/reconnaissance-fixture.mjs` seeds comparative recon evaluation (stale contact, scouts, loaded transport).
- Modern executor returns **empty** transports toward friendly ports (`modern-executor.ts`); coverage exists for loaded convoys, not a **named idle-hull** regression on the evaluation fixture.
- `tests/ai-stale-transport-recon.test.mjs` covers stale investigation; no dedicated idle-reassign test.

## Orient

- Add **fixture-idle-transport** to the evaluation harness (no rule changes).
- Lock behavior with a **1–8 round** bounded `playAiOpponent` test on rules lab + fixture digest stability.

## Decide

PR `cursor/q4-recon-fixture-85b7`:

- Extend `makeReconnaissanceFixture` with charted empty transport away from the convoy.
- `tests/ai-idle-transport-reassign.test.mjs` — lab smoke + fixture distance-to-port gate.

## Act

`npm test`, push, PR.

**Exit:** CI proves idle hulls move toward supply on known fixtures; recon digest unchanged for existing matrix tests.