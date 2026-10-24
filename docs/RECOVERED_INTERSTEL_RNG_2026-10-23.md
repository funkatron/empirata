# Recovered: original Interstel DOS v2.05C RNG (2026-10-23)

**Status:** Original pseudorandom recurrence and output recovered from static disassembly of the privately supplied, EXEPACK-unpacked `EMPIRE.EXE`. Exact seed timing, draw ordering, and full combat parity remain unverified. Do not publish the commercial DOS executable or its unpacked image.

## Disassembly evidence

Unpacked image offset `0x26DC4` (far `25E6:0F64`) implements a 32-bit LCG:

- Multiplier loaded into DX:AX: `0x000343FD`.
- State stored at `DS:784C` (low word) and `DS:784E` (high word).
- 32-bit multiply via runtime at `25E6:1196`.
- Adds `0x00269EC3` using `ADD AX,9EC3` / `ADC DX,0026`.
- Writes new state back; copies high word to AX and masks `AH &= 0x7F`.

Equivalent JavaScript:

```js
function nextEmpireRng(state) {
  const next = (Math.imul(state >>> 0, 0x343FD) + 0x269EC3) >>> 0;
  return { state: next, value: (next >>> 16) & 0x7FFF };
}
```

This matches the standard Microsoft C 15-bit `rand()` recurrence, but here its identity is supported directly by the original **Interstel** disassembly rather than borrowed from another edition.

Seed setter at image offset `0x26DB2` (far `25E6:0F52`) takes a 16-bit argument, puts it in the low state word, and clears the high word. A direct caller occurs at `0x0721`, preceded by a time-related calculation; exact seed-time value conversion still needs validation.

## Direct combat usage

At `0x1A3FE` a combat routine calls `25E6:0F64`, sign-extends AX with `CWD`, performs signed division by **2** (`IDIV CX`), and branches on the remainder at `0x1A409–0x1A418`. Additional nearby calls at `0x1A3D1` and `0x1A44D` use different divisors; the full combat call order remains to be reconstructed. A raw byte scan found 53 occurrences of the far call signature throughout the expanded image; not all are necessarily reachable instructions.

### Seed-1 test vectors

`41, 18467, 6334, 26500, 19169, 15724, 11478, 29358, 26962, 24464`

The accompanying separate recovery archive contains a standalone JavaScript port and 3 passing node:test cases. These independently test overflow, deterministic outputs, seed truncation, and modulo-2 parity—not runtime trace parity.

## Next implementation work

Integrate the recovered RNG behind a selectable internal mode, retain save compatibility, and validate the startup seed and battle-specific draw ordering before enabling it as the default. No live-game behavior has been changed in this research commit.
