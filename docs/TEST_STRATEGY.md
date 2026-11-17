# Empirata test strategy and coverage gates

Updated 2026-11-16. Target ruleset: Interstel DOS v2.05C. Historical DOS binary assets must not be committed.

## Required checks

- **`npm test`** (alias for **`npm run test:coverage`**): TypeScript build, then `node --test` over `tests/*.test.mjs`, **engine-only** V8 coverage, failing below **85% line / 80% branch** (`package.json` → `test:coverage` flags).
- **Runtime:** Node **24** (`package.json` `engines`; CI enforces major version 24 in [`.github/workflows/verify.yml`](../.github/workflows/verify.yml)).
- Coverage alone does not prove DOS fidelity. Manual-confirmed and binary-oracle behaviors use dedicated fixtures (`tests/alg-*.test.mjs`, `docs/manual/`).

## Current coverage (local, Node 24)

Measured on `main` after `npm ci` + `npm test` (2026-11-16, commit `41bf9fe`; reconcile with latest `main` if counts drift):

| Metric | Value |
|--------|--------|
| Tests | **494** pass, 0 fail (`tests/*.test.mjs`, 97 files) |
| Line coverage | **~94.9%** (`dist/engine/*.js`) |
| Branch coverage | **~91.3%** |
| Function coverage | **~96.5%** |
| Typical wall time | ~100 s engine suite (includes build; target remains “fast enough for every PR”) |

Reports intentionally **exclude** `src/ui` and test files; UI regression uses a separate subset in CI (below).

## Default GitHub Actions (`verify` workflow)

On every PR and on `main` pushes that touch non-`docs/**` paths:

1. `tests/ci-scope.test.mjs` + `scripts/ci-scope.mjs` — **focused** vs **full** verification (display-only diffs may skip full `npm test`).
2. **Full scope:** `npm test` (build + engine tests + coverage gates).
3. **Focused scope:** `npm run build` + `tests/unit-names`, `presentation`, `ui-camera`, `ui-structure`.
4. `node scripts/build-single-file.cjs` → standalone `index.html`.
5. `smoke/bundle.mjs`, `smoke/observer-batching.mjs`, and `smoke/ui-load.mjs` (HTML contract smoke; no browser download).

Pages deploy runs on `main` after verify; a green verify on a PR does not by itself prove production Pages freshness.

**Opt-in workflows** (not required for a normal engine PR): compare-reconnaissance, held-out evaluation, map screenshots, Playwright capture-production, replay-uploaded-save, etc.

## npm scripts (testing-related)

| Script | Purpose |
|--------|---------|
| `npm run build` | `tsc` + static assets into `dist/` |
| `npm test` / `npm run test:coverage` | Default engine gate |
| `npm run test:observer` | Observer-mode smoke |
| `npm run test:map-paint-timing` | Map paint timing smoke |
| `npm run evaluate:ai` | Long AI evaluation (local/opt-in) |

## Important regression scenarios

1. **RNG:** seed vectors, determinism, saved draw count (`tests/core.test.mjs`, save roundtrips).
2. **Combat / conquest:** seeded hit allocation, city assault, 128-seed stress where present.
3. **Movement / orders:** allowance, standing orders, go-home, escort, move-to (`tests/move-to.test.mjs`, `home-escort.test.mjs`, …).
4. **Fog of war:** knowledge isolation, stale sightings, route planning on `PlayerView`.
5. **Logistics:** embark/disembark, carriers, load/unload ship, cargo combat, overload (**implemented** — `transport.test.mjs`, `carrier.test.mjs`, `cargo-combat.test.mjs`, `alg-011-overload.test.mjs`, …).
6. **Save files:** schema 1 validation, illegal AI fields, cargo links (`save.ts` + `tests/hardening.test.mjs`, `p0-capture-contamination.test.mjs`).
7. **Computer AI:** Modern (experimental) fixtures under `tests/ai-*.test.mjs`; classic DOS staging under `tests/alg-ai-001-*.test.mjs`, `alg-ai-002-*.test.mjs`, `alg-ai-004-resign.test.mjs`, `campaign-ai-policy.test.mjs`, and `alg-ai-003-grades.test.mjs`. Policy switch: `Game.aiPolicy` + campaign Game menu (v0.5.3).
8. **Cargo rule surface:** embarked `moveUnit` guidance + friendly stacking errors (`embarked-move-guidance.test.mjs`, `p2-cargo-rule-surface.test.mjs`).

## Remaining high-priority gaps

- **Browser UX:** full touch/pinch/inspector acceptance; `tests/ui-gestures.test.mjs` covers pinch/pan/tap math; `ui-camera` + `ui-structure` for layout; opt-in Playwright — no full UI **gate** yet.
- **DOS oracle:** legal/reference traces for draw order, detection edge cases, production rounding (`docs/manual/findings.md`).
- **Adversarial save/import:** deeper limits on payload size and nested knowledge abuse.
- **Mutation / fuzz:** optional; not in default CI.
- **Held-out / compare AI:** screening only; see `agents/evaluation/` and roadmap evaluation discipline.

## Policy

Use **failing red test → smallest rule change → green test**. Prefer exact expected states. Mark uncertain expectations **provisional** in tests and docs.

### Lightweight testing policy

- **No DOS emulator in normal CI.** Fixtures are legally shareable transcripts, seeds, and state snapshots.
- **Default commit path:** Node tests + engine coverage + TS build + bundle smoke (above).
- **Growth control:** table-driven cases, small seeds; long campaigns and `evaluate:ai` stay opt-in.
- **Fixture labels:** executable-verified, manual-derived, or provisional — see `docs/manual/README.md`.

For product priorities use [ROADMAP.md](ROADMAP.md#current-status-2026-11-16), not this file alone.