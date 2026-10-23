# Empirata: unpacked Interstel 2.05C combat cross-references

Date: 2026-10-23. Source: privately unpacked, user-supplied `EMPIRE.EXE`, SHA-256 of reconstructed MZ `0a06eba8ef371847e8c818703ba51e7ab5ef91b732643ca4e422e26923ba8166`.

## Verified code and data

- The EXEPACK decoder reproduced 407 compressed records and reconstructed 4,518 relocation entries; rebuilt MZ length 245,520 bytes and program image length 227,408 bytes. The restored startup at **image offset `0x25E70`** begins `mov ah,0x30; int 0x21; cmp al,0x02` (DOS version check). The earlier original EXE file offset `0x34150` was the packed loader's entry, not the game's startup.
- Printable strings in the unpacked program image: `0x30CB1` " is attacking ", `0x30C90` " was destroyed.", `0x30D8D` " sank the attacking ship", `0x30DE8` " was destroyed!", `0x2EDCF` "  HITS: %d/%d".
- In the disassembled code the string address `0x30D8D` corresponds to a `mov ax,0x2A6D` instruction at image offset **`0x1A6BD`**, and the `0x30DE8` string corresponds to `mov ax,0x2AC8` at **`0x1A75B`**. These are credible **combat-message formatting and outcome report** locations, not proof of the underlying resolver's address.
- The " is attacking " string is referenced through `mov ax,0x2991` at image offset **`0x1A2A2`**; the destroyed string at `0x30C90` is referenced around **`0x19C93`**.
- The code around `0x1A6AB` reads a byte at a dynamically selected game-data location and compares it to `1`, then selects one of two combat strings. This might encode pluralization or counts; no RNG role established.
- A `mul bx` at `0x21389` is provably record addressing, immediately preceded by `mov bx,0x72`, followed by `add ax,0x707E`. It indexes structures of **114 bytes**, not a random-number generator. Multiplication instructions cannot be assumed to indicate an LCG.
- The unpacked image still has exactly three byte sequences `CD 1A` at `0x1A7AD`, `0x1A825`, `0x1A919`, in the previously traced sound/timing region. Packed-file offsets are different. No evidence they drive combat.

## What this means

The unpacked code now provides reliable **anchors** for following the combat reporting path, but it does not yet establish combat result selection or random state. Follow the control flow *backward* from the branch that chooses combat outcomes to the function that supplies the value; then instrument it under DOS to match observed sequences. Do not change Empirata's RNG based on these observations alone.

## Technical note

The 16-bit executable uses far calls (`9A`) and multi-segment addressing; `objdump -b binary -m i8086` is useful for local instruction windows but naïvely disassembling the entire image linearly encounters embedded data and will invent false functions. The string cross-references are a starting point, not a complete cross-reference database.

No original commercial binary or asset is included in this report.