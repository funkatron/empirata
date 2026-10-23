# Empirata: Interstel 2.05C executable is self-unpacking

Date: 2026-10-23. Input: privately supplied `EMPIRE.EXE` (SHA-256 `0304d332df59ea57b58d15a43780583acdab34981c037a60a1c82364b18b5ca9`). **No game binary is redistributed here.**

## Confirmed from the MZ header

- File size: **222,673 bytes**, entirely accounted for by the MZ `e_cp=435, e_cblp=465` header size calculation. **No appended overlay** beyond the MZ-declared image.
- MZ header: 512 bytes (`e_cparhdr=32`), zero relocation entries in the initial header (`e_crlc=0`), initial `CS:IP=33F4:0010`, `SS:SP=39CF:0080`.
- Entry point file position: `0x34150` (`512 + 0x33F4*16 + 0x10`).

## Self-unpacking stub evidence

Beginning at `0x34150`, the entry code copies an encoded data range **backward** (`STD; REP MOVSB`), then transfers control into an unpacking loop. At `0x341B4` the code consumes a packed stream and handles literal/repeat blocks via `0xB0` and `0xB2` markers; the loop uses `REP STOSB` and `REP MOVSB`. Starting `0x341D6` it iterates relocation records, adding the relocated image segment to referenced pointers, before an indirect far jump (`JMP DWORD PTR CS:[BX]` at `0x34236`).

The text `Packed file is corrupt` is present immediately after the stub's error-handling code at file position `0x3424F`.

**Conclusion:** The file is **packed/self-unpacking**. A raw linear disassembly of the executable does **not** comprehensively expose the actual game instructions. Earlier negative searches for familiar random-number multipliers and timer calls were applied to the *packed bytes*. They cannot establish that the original game lacks those constructs, and previously decoded material outside the loader needs to be treated with caution.

This also explains the zero initial MZ relocation count: relocations for the expanded image are applied by the unpacker.

## Next decisive step

1. Run the original EXE under a DOS debugger; break immediately **after** the unpacking stub's final far transfer and dump the expanded memory image, recording load segment and runtime `CS:IP`.
2. Alternatively, emulate the unpacker and reconstruct relocations offline, verifying the reconstructed bytes against a DOS memory dump.
3. Disassemble the **unpacked** image, reconstruct code/data boundaries, then trace combat-state writes and random-number calls.
4. Extract the RNG recurrence and seed initialization from executed instructions; verify through logged repeated combat outcomes.

Do not treat any candidate algorithm as verified until it matches traces from the original game. The current Empirata combat generator should remain unchanged.