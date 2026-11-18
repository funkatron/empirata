# Q28 — post-Q27 follow-up slices (2026-11-18)

User-ordered sequence after H1a/H1b landed on `main` (v0.6.10).

| Slice | Deliverable | Branch (template) | Version |
|-------|-------------|-------------------|---------|
| **H2** | Islands `seed-3898486421` round-376 rim regression fixture + test | `cursor/h2-islands-rim-regression-85b7` | 0.6.11 |
| **H3** | ALG-AI-001 `0x4C52` parity note + ruleset cross-link | `cursor/h3-alg-ai-001-4c52-doc-85b7` | (docs) |
| **H4** | Escort close-range `0x4600` (target-order branch) | `cursor/h4-escort-4600-85b7` | 0.6.12 |
| **H5** | Handoff + slice tracker hygiene | `cursor/h5-post-q27-handoff-85b7` | (docs) |

## H2 success

- Fixture: `tests/fixtures/islands-rim-round-376.json` (organic CvC save, classic grade 1, round 376).
- After **8** `advanceLabRound` calls, east-rim `none` warships (`y=1`, `x≥92`) count **drops** vs loaded state.

## H3 success

- `agents/alg-ai-001-4c52-empirata-parity-2026-11-18.md` maps DOS table row to `classicResolveLegalDirection` / `classicAdvanceBearingWhenBlocked`.
- Ruleset Empirata row cites implementation (no new binary trace required for this slice).

## H4 success

- `classicEscortStep` when Chebyshev to target `< 4`: derive station goal from target standing order before generic station ring.
- Tests in `alg-ai-001-escort-4600.test.mjs` (or extend depth test).

## H5 success

- `local-agent-handoff-dos-ai.md` reflects v0.6.11–0.6.12 and closed H2–H4.
- `classic-migration-slices.md` rows for H2–H5.