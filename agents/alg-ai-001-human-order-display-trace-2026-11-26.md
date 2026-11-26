# ALG-AI-001 human order bytes, unit HP field, and open DOSBox checks

```text
RUN_ID: alg-ai-001-human-order-display-2026-11-26
TRACE_ID: alg-ai-001-human-order-display
IMAGE_SHA256: 145cfabac7ecac70c92a63539fb2d6a2b626e3249c44e5f4cc58ad43a922358b (227408)
FINDING: The unit status line (0x1310A) labels order bytes 0-9 through jump table CS:067A (CS = 12C2).
         5 = "Load Armies/Fighters", 8 = "Escort <target>". The ruleset's 4/5/7/8 labels came from
         string order and are wrong. Byte 8 is also the repair order written by 1D09:07B2.
         163C[u] is ship HP / fighter fuel, so the escort weight 17F6 is a sum of escort HP.
EMPIRATA_GAP: none in code (no engine mapping of DOS order bytes). The proposal "treat player escort
              as order 5" (order-numbering trace) is withdrawn.
NOTES: status line 0x1310A-0x132AE; jump table 0x1329A; repair helper 0x1D842 (1D09:07B2) store at 0x1D8E8
```

## 1. Status line `0x1310A` [D]

For a unit whose owner has `63C0[p] == 0` (computer) the line prints `Computer Control` (`DS:1A4A`). Otherwise it reads the order byte `14E6[u]`. If the byte is above 9 it prints nothing. Else `jmp [cs:0x67A + 2·byte]`:

| Byte | Label (`DS` string) | Then prints |
|---|---|---|
| 0 | `None` (`1A5B`) | — |
| 1 | `Sentry` (`1A60`) | — |
| 2 | `Random` (`1A67`) | — |
| 3 | `Move To ` (`1A6E`) | location from `24A` (`0x30CD`) |
| 4 | `Move ` (`1A95`) | direction name, `24A` indexes the far-pointer table at `DS:1ABE` |
| 5 | `Load ` (`1A9B`) | `Armies` if type `1AB2[u] == 3` (transport), else `Fighters` |
| 6 | `Patrol ` (`1AB1`) | — |
| 7 | `Land on ` (`1A77`) | target from `24A` (`0x32B1`) |
| 8 | `Escort ` (`1A80`) | target from `24A` (`0x32B1`) |
| 9 | `Patrol from ` (`1A88`) | target from `24A` |

Bytes `0xA`–`0x11` have no label. They are computer-only orders, and computer units always show `Computer Control`.

All ten jump targets land on a `mov ax, <string>` instruction, which confirms `CS = 0x12C2` for this table.

## 2. Byte 8 has two writers [D]

- The status line calls it `Escort`.
- The ship repair helper `1D09:07B2` (`0x1D842`), called from the half-HP rule `0x3D10`, stores `14E6[u] = 8` (`0x1D8E8`) and a city location in `24A`. Its dispatch `0x4086` returns status 1 once HP `8ACE == 63B8[type]` (full).

So a ship sent home to repair shows `Escort <city>` on the status line. The half-HP rule skips units already in order 8 (`cmp [8ADA], 8` at `0x3D2E`), so it does not re-target a repairing ship.

**[?]** Which byte the human `E` (Escort Ship) key writes. No menu-index → order-byte table exists (searched as bytes and words); the menu handler is a switch. Byte 8 is the only labelled `Escort`, so it is the expected answer, but this needs the DOSBox check in §5.

## 3. `163C[u]` and `17F6[u]` [D]

`163C` is a far pointer to a 1000-byte per-unit array allocated at `0x0900` (`malloc(0x3E8)`). It is ship HP and fighter fuel (ruleset ALG-002 combat, ALG-010 fuel burn, the repair `INC` at `0x18D01`). Therefore:

- `17F6[X] += 163C[escort]` (`0x1D802`–`0x1D81A`) totals the **remaining HP** of the escorts assigned to `X`.
- Fighter tasking `0x1F7B8` copies fuel into `91B4`. It skips the fighter unless fuel ≥ `63B9` (20, full tank), then halves it and subtracts 4 when `180C[u] < 0`. `91B4` is therefore the **outbound radius**.

## 4. Chart glyph labels (contact-tables trace) — still [?]

No glyph → character table exists; the map draws graphic tiles. The labels in `alg-ai-001-contact-tables-trace-2026-11-25.md` stay inferred from the class, owner, sea and land columns. They are consistent with the `6464` mask order and the ALG-006 type order. See the DOSBox check below.

## 5. DOSBox check for Raiden (one session, both questions)

Use the DOSBox debugger build and a save with one of your destroyers next to one of your transports.

1. Start the game, load the save, select the destroyer, then press **Alt+Pause** to break.
2. In the debugger: `D DS:14E6`. Note the far pointer (offset `O`, segment `S`).
3. `MEMDUMPBIN S:O 3E8`, then rename `MEMDUMP.BIN` to `before.bin`.
4. `F5` to resume. Give the destroyer **Escort Ship (E)** on the transport. Break again and repeat step 3 as `after.bin`.
5. On Raiden, one line: `cmp -l before.bin after.bin`
6. Expected: one changed byte (the destroyer's index) whose new value is octal `10` (= 8). Record the unit index and value.
7. Same session, glyph labels: `D DS:234` gives the chart far pointer; your chart starts at that address plus `6444[p]` (per `0x4A2A`). Read the bytes under a known sea, land and neutral-city square. Expected 2, 3 and 1.

Paste the two results into this file's RUN_ID block. Do not commit `before.bin`, `after.bin` or saves.

## Proposed engine change (not in this PR)

None. Player escort stays a UI order until §5 confirms the byte. When the classic repair rule is implemented, model it as its own order, not as escort.
