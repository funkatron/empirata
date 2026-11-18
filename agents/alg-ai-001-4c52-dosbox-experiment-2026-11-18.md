# ALG-AI-001 `0x4C52` — DOSBox border experiment protocol (2026-11-18)

**Slice I2.** Goal: compare direction byte after **exhaust** at the playable rim vs Empirata `classicAdvanceBearingWhenBlocked` / `classicResolveLegalDirection`.

**Evidence target:** promote mapping in `agents/alg-ai-001-4c52-empirata-parity-2026-11-18.md` from intent-only to **[T]** runtime when a run log is attached.

## Setup

1. Empire 2.05C, classic map with **north border sea** (islands or lab), human=spectator, computer=Blue.
2. Single destroyer with **None** at **`y=1`**, charted sea around it; **spent** after failed north step.
3. Save slot before activation; advance **one computer movement pass**.

## Observe in DOS (Raiden / memory)

| Field | DOS location (ruleset) | Pass criterion |
|-------|------------------------|--------------|
| Compass / direction index | `ES:24A` overload | After exhaust: **`-1`** (stay) **or** rotated index per parity |
| Order byte | unit order | Often becomes **go** / direction write from `0x4C52` follower |

Record **8** probe attempts order if trace available (±1 from `8ADC` parity).

## Observe in Empirata

Same geometry in Rules Lab / import fixture:

```bash
npm run build && node --test tests/alg-ai-001-rim.test.mjs tests/alg-ai-001-islands-rim-regression.test.mjs
```

Inspect unit after `playBlueOpponent`: position unchanged, `go-direction` bearing advanced when all neighbors blocked.

## Acceptance matrix

| Case | DOS | Empirata (v0.6.10+) |
|------|-----|---------------------|
| North blocked at `y=1` | Rotates / stay | `classicRimAwarePreferredIndex` + 8-way probe |
| All 8 blocked | Direction **`-1`**, no move | `classicAdvanceBearingWhenBlocked` on `go-direction` |
| Rim pile regression | (not automated) | H2 islands fixture east-rim count drops |

## Log template

Append runs under `agents/evaluation/4c52-dosbox-runs/` (gitignored if binary saves) or paste summary into this file:

```text
RUN_ID:
SEED/MAP:
UNIT_POS:
PRE_DIR:
POST_DIR:
MOVED: yes/no
NOTES:
```

## Status

Protocol only — **no DOSBox run captured in-repo** for I2 merge. Next: execute one run and attach `RUN_ID` row.