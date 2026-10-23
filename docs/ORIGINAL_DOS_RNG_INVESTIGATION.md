# Historical Interstel DOS RNG investigation

**Status (2026-10-22): algorithm not yet recovered.** Empirata's v0.4 seeded xorshift32 generator is an explicitly non-historical engineering stand-in.

## What we verified

- An archived Interstel DOS **v2.05C** release is listed at https://oldgamesdownload.com/game/empire-wargame-of-the-century-gb4/ .
- An archived game-disk listing identifies **EMPIRE.EXE** from v2.05C as **222,673 bytes** (1988-10-24); v2.05A has 222,303 bytes, v2.05E 224,784 bytes. These are useful variant checks, **not** cryptographic verification: https://forum.winworldpc.com/discussion/8311/ibm-pc-tandy-1000-game-installation-file-listing-screenshot/p155 .
- Walter Bright's later, separate [Empire-D](https://github.com/DigitalMars/Empire-D/blob/master/empire.d) uses `std.random.rand_seed(37, 49)` and `std.random.rand() % p`. **This is not evidence that Interstel DOS 2.05 used this generator.**
- A separate modern [Rust browser recreation](https://github.com/dzoba/empire) reverse-engineered Interstel v2.05E *map and graphics data formats*, but its [RNG is PCG-XSH-RR](https://github.com/dzoba/empire/blob/main/crates/core/src/rng.rs), not a recovered Interstel generator.
- An [anecdotal DOS-player report](https://www.myabandonware.com/game/empire-wargame-of-the-century-ap) associates closely-spaced attacks with streaky outcomes and waiting with different outcomes. This suggests a **testable clock hypothesis**, not a verified fact.
- The Mersenne Twister credited by later Empire Deluxe Combined Edition documentation must not be assigned retroactively to the 1988 release.

## How to recover and verify the actual algorithm

1. **Acquire the exact v2.05C DOS executable**, outside this public repo. Record actual file length, SHA-256 hash, MZ header, and any packing/compression. Do not commit original commercial binaries or assets.
2. **Disassemble as 16-bit x86 DOS MZ code**, with relocation processing (Ghidra or an equivalent DOS-capable disassembler). Search for calls to clock/timer services (`INT 1Ah`, `INT 21h/AH=2Ch`, BIOS tick state) and likely modular arithmetic / integer-state updates. Raw byte hits are clues, not confirmed code.
3. Trace candidate RNG callers to **individual combat hits, city assaults, AI choices, and startup**. Observe where seed is acquired, whether it changes per attack, and how output is converted to a bounded integer or probability.
4. In a **DOS debugger**, capture multiple same-state battles with and without delays. Log seed/state, RNG return values, timer readings, caller addresses and combat outcomes. Test game save/reload behavior too.
5. Port the recurrence and output transformation to TypeScript with accurate unsigned overflow semantics; verify **matching sequences from controlled initial states**.
6. Verify combat draw consumption and event ordering before claiming full gameplay parity. Keep separate statuses: *generator recovered* vs. *exact combat sequence verified*.

## Present blocker

We located archive listings, but have **not obtained the binary bytes** for static or dynamic inspection. There is therefore **no verified seed, recurrence, output transform, or timing dependency** yet. Keep the current manual-probability combat and deterministic saved RNG state unchanged until evidence supports replacement.

Reference notes: https://oldgamesdownload.com/manual/empire-wargame-of-the-century-dos-manual-english/
