# ALG-AI-001 `1D09:03C2` — static trace (escort station)

```text
RUN_ID: escort-03c2-static-2026-11-19
TRACE_ID: escort-03c2-static
IMAGE_SHA256: 145cfabac7ecac70c92a63539fb2d6a2b626e3249c44e5f4cc58ad43a922358b
IMAGE_NOTE: Raiden flat EXEPACK unpack (227408 B). Repo canonical `0a06eba8…` digest not on disk; offsets verified stable vs prior Raiden disasm (agents/alg-ai-002-3adc-slot-trace-2026-11-17.md).
MAIN_COMMIT: a3e523e (PR #179 local-agent trace workflow merged)
J1_PR178: OPEN — cursor/j1-escort-03c2-first-hit-85b7 (not merged at trace time)
```

## Correction (2026-11-23)

`25E6:0F64` is ALG-001 `rand()` (`0x26DC4`), not a static angle table. The 20-iteration loop is **[D]**; the random-word → map-index conversion inside `0x1D452` is still **[?]**. See `agents/q31-a1-escort-station-staged.md`. The “20-angle table” wording below is the 2026-11-19 note and is superseded by that correction.

## FINDING — **20-iteration rand probe + 8-dir (loop bounds [D])**

DOS escort close-range (`0x4600`) calls station helper on the default order branch:

| Site | Target | Role |
|------|--------|------|
| `0x46C2` | `1D09:03C2` | Station tile when close-range order dispatch falls through (push mode `3`, target loc, escorter loc) |
| `0x4625` | `cmp ax, 0x4` | Chebyshev distance gate vs target (`1E46:0957`) |
| `0x46BE` → `0x46C2` | | Only after target-order jump table default (`0x46A8`) |

**`1D09:03C2` linear `0x1D452` (entry used by far call):**

- `mov WORD PTR [bp-0xa], 0x14` — **20-iteration** angular probe loop (`0x1D47E`).
- Each iteration: `call 25E6:0F64` (angle/step), build map index, `call 1A9E:006C` (boolean reachability from escorter).
- **First non-zero `006C` return wins**; returns linear index in `AX`.
- Inner / alternate: **`call 0x1DF56`** (`0x1D5BA`) — eight chart-direction helper.

**`1D09:0DF56` linear `0x1DF56`:**

- `mov WORD PTR [bp-0x6], 0x8` — **8-direction** decrement loop (`0x1DFA9`).
- Walks `ES:06300` offset table from pivot cell; chart mask / sea-class probes; **first pass wins**.

**Conclusion:** Not eight-dir-only. Primary `03C2` path is a **20-slot angular search** with **`1A9E:006C`** gate; **`0DF56` is an 8-neighbor chart walk** reached from within the same routine family. Empirata on **main** still uses **eight adjacent cells + [T] lexicographic sort** — wrong probe shape for strict parity.

## Disasm excerpts (text only)

```
0x46C2: call 1D09:03C2    ; escort-close-range default station

1D47E: mov [bp-0xa], 0x14 ; 20 probe slots
1D489: dec [bp-0xa]       ; loop head
1D4E6: call 1A9E:006C     ; reachability (candidate, escorter)
1D5BA: call 0x1DF56       ; 8-dir helper

1DFA9: mov [bp-0x6], 0x8   ; 8 directions
1DFB7: dec [bp-0x6]
```

Tool: `python3 tools/disasm_empire_anchor.py "$EMPIRE_IMAGE" --expect-sha256 "" --anchor …`  
Reports: `/tmp/empire-escort-4600.txt`, `/tmp/empire-escort-03c2.txt`, `/tmp/empire-escort-df56.txt` (local only).

## EMPIRATA_GAP

| Layer | Main `a3e523e` | DOS |
|-------|----------------|-----|
| Candidate set | 8 neighbors of target | **20-angle** (+ optional **8-dir** `0DF56`) |
| Ordering | `[T]` sort: distance / behind / sea / city | **First hit** in hardware probe order |
| Reachability | `classicRouteStep` per sorted station | **`1A9E:006C`** inside probe loop |

**`EMPIRATA_GAP`:** **need J1 first** (8-dir + reachability first-hit, PR **#178**), then **optional follow-on** for full **20-angle** table (`25E6:0F64` + slot seed) — not blocking J1.

## COMPARED_TO_EMPIRATA

- **#178 (J1):** Removes lexicographic sort; keeps **8 adjacent** chart-passable + reachable first-hit — **partial [D]** vs `0DF56`, **not** vs full `0x14` loop.
- **#176:** Documented **[T]** sort; superseded for parity intent once J1 lands.
- **Tests on main:** `alg-ai-001-escort-station.test.mjs` still asserts **behind preference** (heuristic); J1 branch retargets to probe order.

## Promotion

- Escort station row in `docs/DOS_ALGORITHM_RULESET.md` updated with file offsets and **dual** probe ([D] static 2026-11-19).
- **Do not promote** Empirata station sort to [D] on main — remains **[T]** until #178 merges; **20-angle** remains **[?]** until engine implements or DOSBox corroborates tile choice.