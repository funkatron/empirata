# ALG-AI-002 `0x3ADC` — tracked enemy slot fill (stale vs fresh)

**Date:** 2026-11-17 (Raiden static pass)  
**Target:** Interstel IBM PC **2.05C** unpacked program image (227,408 bytes)  
**Question:** Do the ~20 tracked enemy cells used by `0x3ADC` include **stale** last-known contacts, or only **fresh** sightings?

## Conclusion (overall)

| Hypothesis | Confidence | Tags |
|---|---|---|
| **Slots include stale + fresh chart contacts** (per-player ring of **map indices**; skip `0` sentinel only) | **high** | **[D]** Raiden static pass 2026-11-17 |
| **Fresh-only filter inside `0x3ADC` loop** | **reject** | No `test`/`jz` on age or fresh byte before pathfinder |
| **Live hidden unit positions (`84E[]`) as slot source** | **reject** | Slots are **word map indices** on player base `player×0x28+0xD02`; path uses chart |

**Verdict:** **stale + fresh** chart contacts feed the ring; **`0x3ADC` does not distinguish fresh vs stale** when testing invasion reachability.

**Raiden image:** `/home/coj/private/interstel/EMPIRE_UNPACKED_IMAGE.bin` (EXEPACK unpack via `unpack_exepack.py` on retail 2.05C `EMPIRE.EXE`). Flat image SHA-256 `145cfabac7ecac70c92a63539fb2d6a2b626e3249c44e5f4cc58ad43a922358b` (legacy repo note `0a06eba8…` is the **reconstructed MZ** digest, not this flat slice). Report: `/tmp/alg-ai-002-3adc-report.txt` from `tools/disasm_alg_ai_002_3adc.py`.

---

## Evidence inventory

| Item | Tag | Notes |
|---|---|---|
| Unpacked flat image on Raiden (227,408 B) | **[D]** | SHA `145cfaba…`; disasm anchors match ruleset |
| `0x3ADC` reachability loop (~20 slots, army mask, `ES:234`, path toward city) | **[D]** | `mov [bp-0x6],0x14` at `0x3AF8`; stride `add [bp-0x4],2`; caller `0x377D` |
| `0x383D` live hostile count within 6 tiles (separate gate) | **[D]** | Same ruleset table; **not** the ~20 slot list |
| `0x3490` … `0x383A` per-city production chooser | **[D]** | Far entry `2FB:04E0` → image `0x3490`; runs on computer end-turn before `6D8E++` |
| Sight / chart update `1E46:01AC` → image `0x1E60C` | **[D]** | Writes faction knowledge / markers; candidate slot **writer** |
| Chart overlay pointer `ES:234` | **[D]** | Passability and pathing use **chart glyphs**, not omniscient terrain |
| Manual p. 19: stale = last-known, cleared when rescanned empty | **[M]** | Aligns with stale-inclusive **policy**; not proof DOS AI reads all markers |
| Slot population / fresh filter at `0x3ADC` | **[D]** | Writer `0x1EA94` (from sight chain `0x1EA5C`); insert compares **map index** only |
| In-loop freshness test before `1A9E:004C` | **[D]** | **Absent** (`tools/disasm_alg_ai_002_3adc.py` window: none) |

---

## Static **[D]** findings (Raiden 2026-11-17)

### `0x3ADC` consumption loop

| Offset | Instruction | Meaning |
|---|---|---|
| `0x3AE2`–`0x3AF0` | `imul` player + `add ax,0xD02` | Per-player slot array base |
| `0x3AF3` | `mov [bp-0x2],0x2C86` | Segment / offset pair for `les` walker |
| `0x3AF8` | `mov [bp-0x6],0x14` | **20** iterations |
| `0x3AFF` | `add [bp-0x4],2` | **2-byte stride** (one word map index) |
| `0x3B10` | `cmp es:[bx],0` / `je` | Skip empty slot (**no freshness byte**) |
| `0x3B16` | `push es:[bx]` | Threat **map index** |
| `0x3B1D` | `call 1A9E:004C` | Chart pathfinder (same family as ALG-AI-001) |

### Slot writers (sight path, not `0x3490`)

| Offset | Role |
|---|---|
| `0x1EA94` | Ring insert: same `0x28×player+0xD02` / `0x2C86` base, **20** slots; writes `WORD` at next free or dedupes by map index |
| `0x1EA5C` | `call 0x1EA94` with `[bp+0x6]` = map index — reached from sight/`0x1E60C` update chain |
| `0x1EB32` | Smaller **5**-slot variant (related table); same index-only compare |

Slots hold **chart map indices** recorded when sighting hostiles (or clearing cells), not live unit pointers. Nothing in the insert or consume loops tests a per-slot fresh flag.

### Caller chain

- `0x3490` tree: `0x377D` → `call 0x3ADC` (after destroyer gate, before `0x3B45`).
- `0x383D` remains a **separate** live-unit counter (`0x3B88`).

---

## Architectural **[D]** argument (corroboration)

1. **`0x3ADC` and ALG-AI-001 share chart pathing:** glyph `t = ES:234[loc]` and passability masks (`0x1ACE0` family). That layer is the **faction chart**, which retains last-known enemy cells until invalidated—not live `84E[unit]` coordinates for unreachable units.

2. **Dual threat mechanisms in `0x3490`:**  
   - `0x383D` — counts **owned live** hostiles within Chebyshev **6** (production thresholds `> 5` / `> 2`).  
   - `0x3ADC` — **~20 tracked enemy locs** with **path reachability** (invasion corridor).  
   If `0x3ADC` wanted only **currently visible** threats, a fresh-only table or a live-unit walk would be redundant with `0x383D` / sight refresh. The ruleset already treats these as **different data sources**.

3. **Direction threat → city** with bounded budget (`min(0x7D, 2*chebyshev + 0x19)`) is an **invasion corridor** test on **remembered** beachheads, matching manual stale semantics for production intelligence.

Static slot-writer proof above raises this from corroboration to **[D] high** for stale inclusion.

---

## Expected slot buffer (hypothesis pending disassembly)

```text
// Per current player, fixed-capacity working set (count impression: 0x14 = 20)
struct ThreatSlot {
  loc_t     map_index;   // row-major / 100-wide pitch; path uses ES:234[loc]
  // optional: unit_index, owner, type — confirm in image
  // optional: age or fresh flag — open question for stale vs fresh
};
```

**Fill timing candidates** (xref from `0x3ADC` `SI`/`DI`/`BX` at entry):

1. Start of each `0x3490` pass (per computer player).  
2. Persistent ring updated from `0x1E60C` sight (same chart that feeds `ES:234`).  
3. ~~Merged from live `84E[]`~~ — rejected (see above).

---

## Static analysis procedure (CI-with-secret or local)

**Inputs**

- Unpacked image only (post-stub dump), SHA-256 `0a06eba8ef371847e8c818703ba51e7ab5ef91b732643ca4e422e26923ba8166`.  
- Do **not** commit the file. Mount at e.g. `/home/coj/private/interstel/EMPIRE_UNPACKED_IMAGE.bin`.

**One-shot triage**

```bash
python3 tools/disasm_alg_ai_002_3adc.py "$IMAGE" --report /tmp/alg-ai-002-3adc-report.txt
```

The tool emits:

- Disassembly around **`0x3ADC`** and **`0x3490`** prologue  
- **`E8`** xrefs into `0x3ADC` within `0x3400..0x3F00`  
- **`9A`** far calls in the production tree (compare to `1A9E:014A` pathfinder / `1E46` helpers)  
- Raw hits for **`cmp *, 0x14`** byte patterns  
- **Freshness candidate** lines (`test`/`and` on bytes) between slot-bound `cmp` and pathfinder `call`

**Manual follow-on (raises confidence to [D] high)**

| Step | Action | Proves |
|---|---|---|
| 1 | At `0x3ADC`, confirm loop bound **`cmp cx, 0x14`** (or equivalent) and slot stride (`add di, N`). | ~20 slots **[D]** |
| 2 | At routine entry, note **`DS:`/`ES:`** base + index for slot array; search image for **`mov [base+di], …`** writers. | Slot source **[D]** |
| 3 | Xref writers: **`0x3490`** before city loop vs **`0x1E60C`** sight. If writers copy **chart enemy list** without fresh bit, **stale included [D] high**. | Population **[D]** |
| 4 | Inside loop, before `call` to pathfinder: if **`test byte [slot+off], imm`** + **`jz skip`**, decode **fresh-only [D] high** if `imm` is fresh flag. If **no** such branch, **stale included [D] high** (invalid entries skipped by sentinel only). | Fresh filter **[D]** |
| 5 | Confirm loop loads **map index** only (not `84E[unit]`). | Rejects live hidden **[D]** |
| 6 | Optional: break on **`0x3ADC`** in DOSBox, dump **`ES:234`** at each slot index during one computer turn. | Runtime cross-check **[T]** |

**Bytecode anchors to search** (flat file offsets in unpacked image)

| Pattern | Purpose |
|---|---|
| `3D 14 00` / `83 F9 14` / `83 FA 14` | Slot counter compare |
| `9A 4A 01 9E 1A` (example) | Far call shape; verify segment against MAP |
| Calls near `0x1ACE0` | Chart passability / `ES:234` |
| Call from `0x34xx` → `0x3ADC` | Caller chain from `0x3490` tree |

---

## DOSBox runtime experiment protocol **[T]**

Goal: **prove stale inclusion** without guessing slot layout.

**Setup**

1. DOSBox-X or DOSBox with debugger (`DEBUG` / built-in).  
2. 2.05C, **one human + one computer**; minimal land map (editor or tiny scenario).  
3. Human scouts so computer **charts** a land bridge from its city to square **S**.

**Case A — stale marker, no live unit (proves stale inclusion)**

1. Human moves red army onto **S**; computer sees it (fresh marker on chart).  
2. Human moves army **off** **S** along a route computer **cannot** observe (fog closes).  
3. Ensure **S** stays on computer chart as **stale** (last-known); no fresh red unit elsewhere on reachable land.  
4. End human turn; let **computer production** run (`0x3490` at end-turn for `ES:63C0==0`).  
5. Open computer coastal city production (observer/cheat UI or memory: city `+0xE06`).  

**Expected if stale ∈ slots:** production type **`0` (army)** when path **S → city** is open on **chart** (`ES:234`).  
**Expected if fresh-only:** production **not** army solely from stale **S** (e.g. transport/ship branch).

**Case B — disproven marker (control)**

1. Human **rescans** **S** empty (scout/fighter over **S**); stale marker clears.  
2. Same geography otherwise.  

**Expected:** `0x3ADC` **false** → no army from threat branch (may still army from other gates).

**Case C — hidden live unit off-chart (reject live slots)**

1. Red army sits at **H** (never charted by computer), land path **H → city** exists in truth.  
2. Stale **S** as in A with path, or no markers.  

**Expected:** computer does **not** army-produce for **H** unless **S** (charted) satisfies `0x3ADC`.

**Debugger corroboration (optional [D]+[T])**

- Break **`0x3ADC`** after unpack; note slot count in **`CX`** / index in **`DI`**.  
- Log each slot map index vs human stale marker positions for that player.  
- Single-step: no branch on fresh byte before pathfinder ⇒ **stale included [D] high**.

---

## Pseudocode (reachability pass — **[D] partial**)

```text
subroutine_3ADC(city_loc):
  for slot in threat_slots[player][0 .. 19]:   // base player*0x28+0xD02, stride 2
    if slot.map_index == 0: continue          // empty sentinel only
    if pathfinder(army_mask, from=slot.map_index, to=city_loc, chart=ES:234[player]):
      return true   # production type 0 (army)
  return false
```

---

## Empirata mapping

| Component | Status |
|---|---|
| `classicTrackedThreatLocations` | stale + fresh `view.enemies`; cap 20; fresh wins dedupe — **matches DOS [D]** |
| `classicCityPathInvasionThreat` | chart army reachability — **[D]** |
| `tests/alg-ai-002-3adc-threat.test.mjs` | stale last-known corridor regression |

**Empirata already matches DOS** for stale-vs-fresh policy (no code change required beyond tests/docs).