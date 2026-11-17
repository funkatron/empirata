# ALG-AI-002 `0x3ADC` — tracked enemy slot fill (stale vs fresh)

**Date:** 2026-11-17  
**Target:** Interstel IBM PC **2.05C** unpacked image  
**Question:** Do the ~20 tracked enemy cells used by `0x3ADC` include **stale** last-known contacts, or only **fresh** sightings?

## Evidence status

| Item | Tag |
|---|---|
| Unpacked image on this VM (`/home/coj/private/interstel/EMPIRE_UNPACKED_IMAGE.bin`) | **missing** — static pass not run |
| Prior ruleset row for `0x3ADC` reachability | **[D]** (`docs/DOS_ALGORITHM_RULESET.md`) |
| Slot population / stale filter at `0x3ADC` | **[?]** |
| Manual “stale = last known, not current position” (p. 19) | **[M]** |

Use `tools/disasm_alg_ai_002_3adc.py` when the unpacked image is mounted locally.

## Architectural context (from existing **[D]** ALG-AI-002 / ALG-AI-001)

- **`0x3ADC`** runs inside the computer production chooser **`0x3490`** (per city, high→low).
- Reachability uses **army mask** + **chart glyph** `ES:234[loc]` + path budget `1A9E:014A` (same family as ALG-AI-001 Move-To).
- **`0x383D`** (same tree) counts **live** hostile units within Chebyshev **6** of the city — a separate, omniscient distance gate (`> 5` / `> 2` army branches). It is **not** the same data source as the ~20 slot list.
- The ruleset already distinguishes “tracked enemy locs” for path threat from the scout counter — implying a **per-faction intel buffer**, not a scan of hidden `84E[unit]` positions.

## Expected slot buffer (hypothesis pending disassembly)

Likely layout (to confirm by following `0x3ADC` `SI`/`DI`/`BX` before the slot loop):

```text
// Per current player, fixed-capacity working set (count impression: 0x14 = 20)
struct ThreatSlot {
  loc_t     map_index;   // ES:234 / 100-wide pitch
  // optional: unit_index, owner, type — confirm in image
  // optional: age or fresh flag — THIS is the open question
};
```

**Fill timing candidates** (need xref from `0x3ADC` callers backward):

1. Refreshed at the start of each `0x3490` pass from the faction sight/enemy table.
2. Persistent ring across turns, updated when `1E46:01AC` sight runs.
3. Merged from chart markers plus live units (unlikely given chart-only pathing).

**Clearing rules (Empirata analogue in `knowledge.ts`):**

- Stale contact removed when the old cell is **visible** and **empty** for that detectable type.
- Stale **retained** when the enemy left vision but the square was not rescanned empty.

If DOS uses the same chart markers the human sees, stale coordinates should remain eligible until disproven.

## What `0x3ADC` likely iterates (reachability pass) **[D] partial**

From ruleset + Q17 plan (path direction **enemy loc → city**):

```text
subroutine_3ADC(city_loc):
  for slot in threat_slots[0 .. N-1]:   // N ≈ 20, stop on first hit
    if slot.map_index == invalid: continue
    // [?] if fresh_only: skip unless slot.fresh
  #if pathfinder(type=army, from=slot.loc, to=city_loc, chart=ES:234[player]):
      return true   // production picks army (type 0)
  return false
```

Static confirmation steps on the image:

1. At `0x3ADC`, find `cmp cx, 0x14` or `inc di` / `add di, stride` × 20.
2. Backtrace slot pointer to `DS:`/`ES:` segment; xref writers from `0x3490` prologue or sight (`0x1E60C`).
3. Inside the loop, note any `test`/`and` on a **fresh/stale** byte before calling `1A9E:014A`.

## Recommended Empirata policy (pre-binary)

| Policy | Confidence | Rationale |
|---|---|---|
| **Include stale + fresh** sight coordinates (dedupe by map cell, cap 20 nearest to city) | **medium** | Separate from live `0x383D` scan; chart reachability matches player intel; manual stale semantics; current `classicTrackedThreatLocations` shape |
| Fresh-only filter | **low** | No static proof yet; would match modern AI caution patterns but contradict “tracked loc” wording |
| Live hidden unit positions | **reject** | Contradicts `ES:234` pathing model used elsewhere for classic AI |

**Suggested test matrix once DOSBox trace is possible:**

1. Stale army on land corridor → path open → computer assigns **army** at `0x3490`.
2. Same, but rescanned empty (marker gone) → no army from `0x3ADC`.
3. Fresh unit with no path vs stale marker with path → army only when path from **stale** cell (proves stale inclusion).

## Empirata mapping

- `classicTrackedThreatLocations` — all `view.enemies` positions (stale + fresh); **[?]** vs DOS
- `classicCityPathInvasionThreat` — reachability **[D] staged** (chart army passability)
- Movement `classicArmyConquestStep` blocks **fresh** enemies on tiles only — not authoritative for production slots