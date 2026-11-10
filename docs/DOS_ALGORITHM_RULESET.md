# Interstel DOS 2.05C — Algorithm Ruleset

**Status:** Living research document. Algorithms are tagged by evidence; unresolved items stay explicit.  
**Target:** *Empire: Wargame of the Century*, Interstel IBM PC **v2.05C**.  
**Prepared:** 2026-11-09; last extraction pass 2026-11-10  
**Does not claim** full runtime parity with every DOS playthrough.

> Commercial `EMPIRE.EXE`, unpacked images, maps, and the manual PDF stay **outside** this repository. Analysis used a private working copy only.

## 0. Provenance

| Artifact | Location (private) | Hash / size |
|---|---|---|
| Packed `EMPIRE.EXE` | `/home/coj/private/interstel/.../Game Files/EMPIRE.EXE` | SHA-256 `0304d332df59ea57b58d15a43780583acdab34981c037a60a1c82364b18b5ca9`, 222,673 bytes |
| Unpacked program image | `/home/coj/private/interstel/EMPIRE_UNPACKED_IMAGE.bin` | 227,408 bytes; EXEPACK decode: **407** records, **4,518** relocations |
| Manual PDF | `/home/coj/empire-wargame-of-the-century_dos_manual_en_gb4.pdf` | SHA-256 `f1173d95910ea9658b954177936753191bd15e1efd61027073f9b910e90bb1cd` (matches [manual/source-record.md](manual/source-record.md)) |
| Disk `README.DOC` | same ZIP | Author errata: cruiser first/repeat production **36 / 30** (manual text wrong) |

Prior research retained as history: [RECOVERED_INTERSTEL_RNG_2026-10-23.md](RECOVERED_INTERSTEL_RNG_2026-10-23.md), [UNPACKED_COMBAT_XREFS_2026-10-23.md](UNPACKED_COMBAT_XREFS_2026-10-23.md), [PACKED_EXECUTABLE_FINDING.md](PACKED_EXECUTABLE_FINDING.md), [DOS_CALL_SITE_AUDIT_2026-10-23.md](DOS_CALL_SITE_AUDIT_2026-10-23.md).

### Evidence tags

- **[D]** Disassembly-confirmed control flow / formula (static, unpacked image offsets)
- **[T]** Runtime / DOSBox debugger trace-confirmed
- **[M]** Manual-confirmed only
- **[?]** Unresolved — do not treat as an authoritative rule

Image offsets below are into the **unpacked program image** (not the packed file). Far addresses such as `25E6:0F64` match the reconstructed CS:IP used in earlier notes.

---

## 1. Recovered algorithms

### ALG-001 — Pseudorandom generator **[D]**

**Anchors:** seed setter `0x26DB2` (`25E6:0F52`); next-value `0x26DC4` (`25E6:0F64`); state at `DS:784C` / `DS:784E`.

```text
state' = (state * 0x343FD + 0x269EC3) mod 2^32
output = (state' >> 16) & 0x7FFF          // 15-bit Microsoft C rand()
```

**Seed setter (`0x26DB2`):** writes the 16-bit argument into `DS:784C` and clears `DS:784E`.

**Startup seed [D]:** init path `0x070D–0x0726`:

```text
t = time_mix()                 // far 10E8:0076 → image 0x10EF6
  // gettime (25E6:0A74) → local DOS time fields
  // t = ((time_lo, time_hi & 0x8F) * 200) + (field / 5)   // 32-bit helpers
seed = (t / 20) + 1            // 32-bit div at 25E6:10FA, then INC AX
srand(seed)                    // 25E6:0F52
```

**Empirata:** [`src/engine/rng.ts`](../src/engine/rng.ts) implements this recurrence. Parity: **matches** generator; clock→seed and per-fight draw schedule still diverge unless Empirata mirrors the `/20+1` init.

Seed-1 vectors: `41, 18467, 6334, 26500, 19169, 15724, 11478, 29358, 26962, 24464`.

---

### ALG-002 — Unit-vs-unit HP combat **[D]**

**Anchor:** skirmish resolver `0x19900` (calls animation `0x1A0C3` only after HP is settled).

**Per-hit damage table** `DS:2964` / image `0x30C84` (army…battleship):

`[1, 1, 1, 1, 3, 2, 1, 3]`

**Combat efficiency** word `DS:6368[player]` — default **50** at init (`0xF342`). Distinct from production efficiency `DS:6CB6` (also 50).

```text
atk_hp = (atk_type >= 2) ? ES:163C[atk] : 1     // ships use remaining HP; army/fighter = 1
def_hp = (def_type >= 2) ? ES:163C[def] : 1
atk_dmg = table_2964[atk_type]
def_dmg = table_2964[def_type]
atk_eff = DS:6368[atk_owner]
def_eff = DS:6368[def_owner]

// Manual half-factors applied to combat efficiency [D]:
if atk_type > 1 and def_type == 0:  def_eff >>= 1   // ship vs army
if atk_type in {3, 6}:              atk_eff >>= 1   // transport / carrier attacking
if def_type in {3, 4}:              def_eff >>= 1   // vs transport / submarine

loop:
  roll = rand() % 200
  threshold = atk_eff - def_eff + 100
  if threshold > roll:          // attacker lands the hit
    def_hp -= atk_dmg
    if def_hp <= 0: break as attacker win
  else:                         // defender lands the hit
    atk_hp -= def_dmg
    if atk_hp <= 0: break as defender win

// Winner (ships): write remaining HP back to ES:163C
// Loser: destroy via 0x19CBE / 0x1908B; then play animation 0x1A0C3
```

**Stop condition [D]:** first side whose HP drops to ≤0 after a damage subtract loses; loop does not continue.

**Empirata:** weighted `attack/(attack+defend)` per hit without the `%200` threshold or efficiency-halving table. Parity: **differs**.

---

### ALG-002b — Combat animation only (`0x1A0C3`) **[D]**

Separate from HP. Round count:

```text
n = ES:6366          // default static 50; per-player copy at player+0x5C
rounds = 1 + rand() % ((n >> 1) + 1)    // with n=50 → 1..26 flashes
```

Each flash: `rand()%2` picks which unit icon to blink; `13EC:0D39` is map/UI (not HP). `rand()%75` feeds a delay helper.

**Q-02:** `ES:6366` is the **animation intensity** byte (init 50), not HP.

---

### ALG-003 — Display factor helper `0x19878` **[D]**

Used by the animation/UI path to format strength labels. Damage-per-hit for real combat is the flat `DS:2964` table in ALG-002 (not this helper’s return). Half-factors are the efficiency SARs in ALG-002.

**Empirata:** `STATS.*.hitDamage` aligns with `2964` for several types; verify each row in tests.

---

### ALG-004 — City assault roll **[D]**

**Anchor:** `0x19561–0x195A7`.

```text
roll = rand() % 100                    // 0..99
eff  = DS:6368[attacker_player]        // combat efficiency, default 50
if eff >= roll: capture path (then ALG-009 reset)
else:           repulse path
```

At default 50% combat efficiency → success when `roll ≤ 49`? **`eff >= roll`** → rolls `0..49` succeed (50/100). Matches the manual’s efficiency story **[M]+[D]**.

**Empirata:** `U[0,1) < efficiency/100`. Parity: **matches** at 50% (both ~half); edge rolls near 0/99 warrant a fixture.

---

### ALG-005 — (merged into ALG-002)

The `%200` attrition loop at `0x19ACC` **is** the unit-vs-unit HP resolver (ALG-002). This ID kept so older cross-refs stay valid.

---

### ALG-006 — Production base times + efficiency scaling **[D]**

**Anchors:** calculator `0x103CD` (near-called as prod helper); static tables in DS image base `0x2E320`:

| Table | DS offset | Image | Bytes (army…battleship) |
|---|---|---|---|
| First build | `0x6CAC` | `0x34FCC` | `6,12,24,30,24,36,48,60` |
| Repeat build | `0x6CC0` | `0x34FE0` | `5,10,20,25,20,30,40,50` |

Unit index order: army, fighter, destroyer, transport, submarine, cruiser, carrier, battleship.

```text
efficiency = word[player] at DS:6CB6          // default init 0x32 (50) at 0xF363
if efficiency == 0: return 999
base = first_table[type] if first_cycle else repeat_table[type]
turns = (50 * base) / efficiency              // 16-bit idiv
if turns > 999: turns = 999
return turns
```

At the default **50%** efficiency, `turns == base` exactly. 100% halves times; 25% doubles. Matches the manual’s efficiency description **[M]+[D]**.

Cruiser **first = 36** in the binary table — agrees with disk `README.DOC`, not the manual’s 42/35 typo and not Empirata’s current `35`.

**Turn deadline bookkeeping [D]:** per-player word `DS:6D8E` increments each player turn (`0xE853`, `0xFB76`). City progress/deadline at `+0x18F4` is set to `6D8E + turns` when production is (re)armed (`0xEB29`). City produces when `6D8E >= city.18F4`.

**Empirata:** `requiredProductionTurns` only allows 50% and uses `STATS.cruiser.first = 35`. Parity: **differs** (cruiser 35 vs 36); efficiency scaling **unimplemented**.

---

### ALG-007 — Global unit slot / overpopulation cap **[D]**

**Anchors:** unit allocator `1E46:077B` → image `0x1EBDB`; fail path `0x1ED00`; production loop `0xE999`; message gate `0xED0B–0xED3A` (“The world is overpopulated.|Production is temporarily halted.”).

```text
allocate_unit_slot():
  for i in 0 .. 999:                    // cmp [bp-2], 0x3E8
    if slot_state[i] == 0:
      initialize slot i; return success (writes out-index)
  return 0                              // AX=0 at 0x1ED00
```

When city production cannot place a completed unit (`1E46:077B` returns 0), the production loop sets flag `ES:6C80 = 1`. After scanning cities, if `6C80 != 0` and `ES:646C != 0`, the overpopulation dialog is shown.

So the numeric saturation limit is **1000 unit slots** (indices `0..999`), not an arbitrary undocumented constant.

**Embarked-slot accounting [D]:** free-slot test is `ES:1654[i] == 0` (`0x1EC02`). Cargo units are full unit records (own slot, type, HP/fuel); boarding does not free `1654`. Therefore armies-in-transports and fighters-on-carriers **do** consume the global 1000 slots. High-water index `ES:6D9E` tracks the densest live index for scans.

**Empirata:** no global unit-cap halt (MF-09). Parity: **unimplemented**.

---

### ALG-008 — Begin-turn city production loop **[D]** (timing formula partial)

**Anchor:** `0xE999–0xED3D`.

Per current player (`ES:6CB4`):

1. Iterate city indices downward from `ES:6384`.
2. Skip cities not owned by the current player (`owner` byte at `+0x1098`).
3. If production-type word at `+0xE06` is negative, run a setup path (`0xE9E0`) that can call `0xF40F` then force-select production UI helpers.
4. Else compare city progress word at `+0x18F4` against a per-player word at `ES:[player*2 + 0x6D8E]`; when the compare allows, attempt to spawn via `1E46:077B`.
5. On spawn failure → ALG-007 overpop flag; on success → update progress / notify (“just produced…” at `0x9005`).

Turn-count formula and first/repeat tables are **resolved in ALG-006**. Function `0xF40F` also copies per-player tables into working cells, including the combat round-count byte consumed at `ES:6366` (see ALG-002).

**Empirata:** `beginTurn` + `requiredProductionTurns` / `selectProduction`. Parity: **partial** (phase shape matches; cruiser first and efficiency scaling differ — ALG-006).

---

### ALG-009 — Capture production reset **[D]**

**Anchor:** post-assault helper `0x195C6` (called after successful city path from ALG-004).

Observed writes for the captured city record:

- Owner byte at `+0x1098` ← current player
- Production-type word at `+0xE06` ← `0xFFFF` (−1 / unset)
- Aux word at `+0x16A` ← `0`
- Five related bytes at `+0x1662` ← `0xFF`
- Map/overlay byte computed as `10 * player − 6` written through terrain pointer `ES:234`

So a freshly captured city does **not** keep prior production; it is cleared to “no selection” (`0xFFFF`). Matches manual discard-on-capture intent at a high level **[M]+[D]**. Empirata’s exact post-capture prompt timing remains a separate UI/AI concern.

**Empirata:** capture adjudication + production clear. Parity: **unknown** (likely close; needs fixture).

---

### ALG-010 — Fighter fuel burn and crash **[D]**

**Anchors:** movement fuel path `0x18C3E–0x18C7D`; crash message `0x18CA0` (“Your fighter ran out of fuel and crashed.”); docking confirm `0x18D2A`.

```text
fuel_byte[unit] -= 1          // DEC at ES:163C[unit]
if fuel_byte <= 0:
  destroy / remove fighter    // call 0x1908B then exit
else:
  continue movement bookkeeping
```

Special case: when a local type field equals `6` (`cmp … 0x6D44, 6`) and another arg is `-1`, an extra bulk fuel subtraction can run before the per-step decrement (`0x18BFF–0x18C2F`) **[?]** meaning (possible transport/carrier interaction).

Max fuel constant `20` is **[M]** / **[D]** (`DS:63B9`). Full refuel to 20 on friendly city or carrier — ALG-013. Ship HP shares `163C`/`63B8` (not fighter).

**Empirata:** fighter fuel decrements per move; crash at 0; full refuel at city/carrier. Parity: **matches** at high level.

---

### ALG-011 — Transport/carrier overload destruction **[D]**

**Anchor:** scan/destroy `0x18E40–0x18FDA`; message helper `0x19C5B` (pluralization only).

```text
capacity = remaining_HP (ES:163C[ship])
if ship_type == 3 (transport):
  cargo_type = 0 (army)
  capacity <<= 1                  // 2 armies per HP
else:                             // carrier path
  cargo_type = 1 (fighter)

count = 0
for unit_index from high_water down to 1:    // ES:6D9E downward
  if unit on ship tile and type == cargo_type:
    count++
    // keep first `capacity` cargo (high index first)
    if count > capacity:
      destroy unit via 0x19CBE
      killed++
if killed: show "... is overloaded!" + 0x19C5B(killed, cargo_type)
```

**Survivor policy [D]:** scan **high unit index → low**; the first `capacity` matching cargo survive; later ones are destroyed. No RNG in selection.

**Empirata:** `moveUnit` **rejects** overloaded transport moves (MF-03) instead of destroying surplus. Parity: **differs**.

---

### ALG-012 — Detection matrix + sentry wake **[D]**

**Anchors:** sight/update `1E46:01AC` → image `0x1E60C`; matrix DS:`0x6D00` / image `0x35020`; neighbor deltas DS:`0x62FE`; order bytes at far ptr `DS:14E6`; Sentry string/jump “Sentry” = order value **1**.

**Neighborhood [D]:** loop walks 9 map offsets (center + 8), deltas signed words  
`[0, 1, −99, −100, −101, −1, 99, 100, 101]` — Moore / Chebyshev radius 1 on a width-100 pitch. Center index `0` skips the type-detection branch (`cmp [bp-0xE],0` at `0x1E68D`).

**Matrix index [D]:**

```text
idx = (observer_type << 3) + target_type   // types 0..7
if byte[DS:6D00 + idx] == 0:
  // suppress unit detection (may still remap display class via +0x63CE)
```

Static dump (observer rows → target cols; order army, fighter, destroyer, transport, submarine, cruiser, carrier, battleship; `1` = detects):

| obs \ tgt | A | F | D | T | S | C | V | B |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Army | 1 | 1 | 1 | 1 | 0 | 1 | 1 | 1 |
| Fighter | 1 | 1 | 1 | 1 | 0 | 1 | 1 | 1 |
| Destroyer | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| Transport | 1 | 1 | 1 | 1 | 0 | 1 | 1 | 1 |
| Submarine | 0 | 0 | 1 | 1 | 1 | 1 | 1 | 1 |
| Cruiser | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| Carrier | 1 | 1 | 1 | 1 | 0 | 1 | 1 | 1 |
| Battleship | 1 | 1 | 1 | 1 | 0 | 1 | 1 | 1 |

**Sub column:** only destroyer, submarine, and cruiser detect subs. Army/fighter/transport/carrier/BB do not. **Sub row:** subs do not detect armies or fighters.

**City observers [D]:** cities call sight with **observer type = `-1`** (`0xE522`, `0xEA03`). In `0x1E60C`, `cmp [bp+0xA],0` / `jl` skips the 8×8 suppress path when type < 0 — cities are **not** matrix-limited and therefore **detect submarines** (and all other types). Matches manual **[M]+[D]**.

**Sentry wake [D]:**

1. Inside the same sight walk (`0x1E8A0–0x1E8E0`): when a neighboring enemy tile passes the matrix, units on the observer’s tile matching the observer type have order byte cleared to `0`.
2. Contact helper around `0x19E2C`: units on a contact tile with order ∈ `{1, 6, 0xC}` also clear to `0`.

Order name table near `0x2FD6E`: `None=0`, `Sentry=1`, `Random=2`, `Move To=3`, `Land on=4`, `Escort=5`, `Patrol from=6`, … **Order `0xC`** is written by delayed-order paths (`0x1D7E1`, `0x1DDF1`) — the Wait/sleep standing order (menu string `Wait` at `0x3056F`). Wake set = **Sentry + Patrol-from + Wait**.

**Empirata:** city sub detection now aligns; still **omits sub→sub**; wakes only `sentry`, not patrol/wait. Parity: **partial**.

---

### ALG-013 — Turn phases + dock repair/refuel **[D]**

**Per-player turn spine** (`0xFCB4`–`0xFD55`, same CS as production):

1. **`0xE999` — city production** for `ES:6CB4` (ALG-008).
2. If per-player unit-count word at `+0x15EA` ≠ 0 (skip when the player has no units):
   - `0xF40F` — per-player table copy / setup.
   - **`0xF69E` — movement phase** (only far caller of unit activator `1855:000A` → `0x1855A`).
3. `0xFE1A` — production-ETA / ranking helper (not movement).
4. Optional `0xF9D2` when mode flags require it.
5. **`0xE818` — end-of-turn bookkeeping:**
   - `0xDF58` recounts cities per owner.
   - Increments per-player turn word `ES:6D8E` (production deadlines).
   - Ticks per-unit delay bytes (`ES:1654` at `0xE94C`); no HP repair here.
6. Advance `ES:6CB4` (`0xFB85`) and wrap with player-count `ES:6C7E`.

**Movement phase `0xF69E` [D]:**

1. Grant move points: for each living unit owned by the current player, `ES:19D4[unit] ← DS:168E[type]`  
   (`[1,5,3,2,2,2,2,2]` = army…battleship allowances).
2. Round-robin activate units with `19D4 > 0` via `1855:000A`.
3. Pass limit local: **100** if `ES:63C0[player] ≠ 0` (human), **1** if computer — then re-scan while moves remain.
4. Direction input defaults to **`-1`** (`0x11214`). Index `-1` shifted reads neighbor table `DS:62FE` word **0** → **stay** (delta 0).

**Ship repair / dock tick [D]** — sole `INC` of `ES:163C` in the image, at `0x18D01` inside step helper `0x1869D`:

```text
// reached when direction == -1 (stay) OR unit actually changed tiles
// and destination tile is owned by current player; unit type >= 2 (ships)
cap = DS:63B8[type]              // [0,20,3,3,2,8,8,12]
if ES:163C[unit] < cap:
  ES:163C[unit]++                // +1 remaining HP
ES:19D4[unit] = 0                // end this unit's moves for the turn
```

So **idle docked repair is real [D]**: a ship already on a friendly city that is activated and stays (`dir = -1`) still takes the dock path (the `-1` check at `0x18CA7` bypasses the “same-tile skip”), gains **+1 HP**, and has its moves cleared — at most **one** repair tick per unit per movement phase. Moving onto a friendly city does the same. There is **no** separate begin-turn repair loop (confirmed: no `163C` mutator under `0xE818` / production).

`DS:63B8` caps: fighter fuel **20**; ship max HP **3/3/2/8/8/12**. Combat writes remaining HP into `163C` for ships (`0x19B2F`). Half-HP speed uses `163C <= cap/2` (`0x189CE`).

**Fighter refuel [D]** — full restore to `DS:63B9` (=20), not +1: land on friendly city (`0x192A3`) or carrier terrain (`0x18880–0x1889C`).

**Empirata:** `beginTurn` auto-repairs sea units in coastal ports before production, then movement. DOS repairs during **movement** when the unit docks/stays. Same +1/turn rate if every docked damaged ship is activated once; schedule differs. Fighter full refuel on city/carrier matches Empirata’s full top-off more closely than the ship +1 path.

---

## 2. Empirata mapping snapshot

| ALG | Empirata symbol | Status |
|---|---|---|
| ALG-001 RNG recurrence | `nextRandom` / `nextRandom15` | **matches** math; seed/schedule **partial** |
| ALG-002 HP combat `%200` | `resolveCombat` | **differs** (threshold vs weighted) |
| ALG-002b animation `%2` | — | presentation only |
| ALG-003 hit-damage table `2964` | `STATS.*.hitDamage` | **partial** (compare rows) |
| ALG-004 city assault | `resolveCityAssault` | **matches** family (`eff >= rand%100`) |
| ALG-006 production tables + efficiency | `STATS` / `requiredProductionTurns` | **differs** (cruiser 35 vs 36; no efficiency scale) |
| ALG-007 unit cap 1000 + embarked | — | **unimplemented** |
| ALG-008 city production loop | `beginTurn` / production | **partial** (see ALG-006) |
| ALG-009 capture production reset | capture + `selectProduction` | **unknown** (likely close) |
| ALG-010 fighter fuel/crash | `moveUnit` fuel | **matches** high level |
| ALG-011 transport overload | `moveUnit` | **differs** (reject vs destroy) |
| ALG-012 detection matrix | `knowledge.ts` | **partial** (sub↔sub; wake set) |
| ALG-013 turn + dock repair/refuel | `beginTurn` / dock repair | **partial** (schedule) |

---

## 3. Open queue (priority)

| ID | Topic | Status |
|---|---|---|
| Q-01 | Combat stop / HP writes after each hit | **resolved [D]** — ALG-002 |
| Q-02 | `ES:6366` round-count byte | **resolved [D]** — animation intensity (default 50); ALG-002b |
| Q-03 | Half-factor unit-type IDs | **resolved [D]** — ALG-002 (types 0,3,4,6) |
| Q-04 | City assault efficiency layout | **resolved [D]** — ALG-004 (`6368[player] >= rand%100`) |
| Q-05 | Production first/repeat + efficiency → `0x6D8E`/`0x18F4` | **resolved [D]** — ALG-006 |
| Q-06 | Overpopulation + embarked slots | **resolved [D]** — ALG-007 (embarked consume slots) |
| Q-07 | Detection matrix + sentry wake + city observers | **resolved [D]** — ALG-012 |
| Q-08 | Repair phase; main turn driver order | **resolved [D]** — ALG-013 |
| Q-09 | Startup seed from clock | **resolved [D]** — ALG-001 |
| Q-10 | Original AI policy | out of scope |
| Q-11 | Overload survivor selection | **resolved [D]** — ALG-011 (high→low index; first `capacity` live) |

---

## 4. Method notes for the next pass

1. Prefer HP / ownership / production-counter writes → backtrace over linear dumps.
2. Instrument DOSBox-X on a saved fight: log `25E6:0F64` returns and the `% 2` / `% 100` / `% 200` sites.
3. Keep shareable fixtures as seed vectors and state deltas only — never commit binaries.
4. Engine changes require a separate approved PR after evidence lands here.

---

## 5. Related Empirata docs

- Player-facing / manual layer: [Empirata_Classic_Rules_Specification_v0.1.md](Empirata_Classic_Rules_Specification_v0.1.md)
- Manual findings: [manual/findings.md](manual/findings.md)
- Conformance audit: [MANUAL_CONFORMANCE_AUDIT.md](MANUAL_CONFORMANCE_AUDIT.md)
