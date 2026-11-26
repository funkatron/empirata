# ALG-AI-003 mode flags `ES:62E8[0…10]`

```text
RUN_ID: alg-ai-003-mode-flags-2026-11-26
TRACE_ID: alg-ai-003-mode-flags
IMAGE_SHA256: 145cfabac7ecac70c92a63539fb2d6a2b626e3249c44e5f4cc58ad43a922358b (227408)
EXE_SHA256: bff96e2cebdd152834e2a89cb3b5e631313453646b697f79bbd77733838155d7 (245520; load module == image)
FINDING: 0xF40F writes 11 words ES:62E8..62FC (not 12) = (840[p] == 2) on every computer turn. The static
         default 1 is only seen on human turns. On grade 1 (Empirata's default) every flag is 0.
EMPIRATA_GAP: dosAiModeFlags returns 12 entries. The 2026-11-24/25 trace proposals read 62F2/62F4/62F6 as
              "option, default 1"; under grade 1 they are 0.
NOTES: writer 0xF40F (loop 0xF430-0xF46D); callers 0xE9F9, 0xEABB (turn loop), 0xFCE6
```

## 1. Writer `0xF40F` [D]

```text
p = byte ES:6CB4                       // current player
if word ES:840[p] == 0: skip           // human: flags keep their previous values
for i = 10 down to 0:                  // [bp-2] = 0xB; test-then-decrement loop
    word ES:62E8[i] = (ES:840[p] == 2) ? 1 : 0
```

- The loop body runs for `i = 10 … 0`, so it covers `62E8` through `62FC`. `62FE` is **not** written; it is the head of the direction table (`62FE[9] = −1` at `0x6310`). This corrects the ruleset's `i = 0…11`.
- Every reader in §2 is a `cmp word es:[62xx],0` (or a byte read). There is no other store, which explains why the 2026-11-25 traces found "no direct store".
- Static image values: `62E6…62FC` are all 1 and `62FE` is 0. Those 1s are what a human turn sees before the first computer turn runs.

## 2. Flag map [D for sites; reading [?] where marked]

Grade 1 → all 0. Grade 2 → all 1.

| i | Word | Reader (function) | What the flag gates |
|---|---|---|---|
| 0 | `62E8` | `0x35C5`, `0x361A`, `0x36D1`, `0x3756` (`0x30EB`) | Production/inventory branches (ALG-AI-002 already uses this) |
| 1 | `62EA` | `0x3DB4` (`0x3BFC`); `0x1F8DA` (`0x1F7B8`) | Production branch when `8ADA ≠ 5`; fighter tasking calls `0x1FB92(unit, 1)` only when set |
| 2 | `62EC` | `0x1F887` (`0x1F7B8`); `0x1FD60` (`0x1FB92`) | Fighter tasking: a branch taken only when the unit's order byte `14E6[u] == 3`; in `0x1FB92`, distance padding `d += (d − 1)/5 + 1` |
| 3 | `62EE` | `0x4283` (order `0xD` dispatch `0x424A`) | When set and `8AD0 ≥ 4`: a `rand() % 10` test |
| 4 | `62F0` | `0x3A27`, `0x3A9C` (`0x39A9` ship mix) | When set: `E06[8AC2] = 7` (ALG-AI-002) |
| 5 | `62F2` | `0x4224` (order `0xC` dispatch `0x421E`); `0x1D231` (`0x1D1A6`) | 0 → order `0xC` status 1 (reissue every activation), **and** `0x1D1A6` calls `0x1DD44` (attach escort to a transport). Set → keep escort until the target dies; no `0x1DD44` call here |
| 6 | `62F4` | `0x4B5F` (`0x4B52`); `0x1D530`, `0x1D637` (`0x1D50E`) | 0 → `0x4B52` returns 1 at once. In `0x1D50E`, set and 0 take different `DS:4BD0` mask-search paths (set: a branch that first checks `14E6[u] == 8`) **[?]** exact effect |
| 7 | `62F6` | `0x1F4CD` (`0x1F454`); `0x1DB90` (`0x1DA38`) | Army city tasking: set → Chebyshev ≤ 20 plus per-city cap `(120 − 6368[p]) / 10`; 0 → ≤ 12, no cap |
| 8 | `62F8` | none found | — |
| 9 | `62FA` | `0x473D` (`0x4714` order 5/`0xF` picker) | 0 → skip the block to `0x47CA`; set → ship sea mask set B (already in ruleset) |
| 10 | `62FC` | `0x1DBDA` (`0x1DA38`) | Read as a **byte** shift count: `sar ax, cl` before a compare. Grade 1 no shift; grade 2 halves |

`6368[p]` is combat efficiency (ruleset ALG-002, default 50 at `0xF342`), so the grade-2 cap is `(120 − 50) / 10 = 7` at the start.

## 3. Consequences for Empirata

| Item | Before this trace | Now |
|---|---|---|
| `dosAiModeFlags` | 12 entries | Should be **11** (`62E8…62FC`) |
| Army tasking (`0x1F454`) proposal | "radius 20 + cap (option default)" | **Grade 1: radius 12, no cap.** Grade 2: radius 20 + cap |
| Computer escort `0xC` | "releases only when the target dies" | **Grade 1: reissued every activation**, and `0x1D1A6` attaches escorts to transports. Grade 2: kept until the target dies |
| Ship contact masks (`62F4`) | "enabled by default" | **Grade 1: off** (`0x4B52` returns 1 early) |

Engine PRs built from the 2026-11-24/25 proposals must branch on `aiPolicy.grade`. The default campaign and the golden test both use grade 1.

## Proposed engine change (not in this PR)

1. `dosAiModeFlags`: length 11; update `tests/alg-ai-003-grades.test.mjs`.
2. When implementing army tasking, escort (`0xC`) and contact masks, take the flag from `dosAiModeFlags(grade)[i]` using the table above.
