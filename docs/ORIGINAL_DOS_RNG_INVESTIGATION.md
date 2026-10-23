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

## Follow-up investigation (2026-10-22)

### Exact archived download identified

The Old Games Download file entry explicitly identifies **Interstel DOS v2.05C**, with a 161.3 KB archive:

- [Archive entry](https://oldgamesdownload.com/file/eecd488e-851f-47bb-8118-e19365ea63b6/)
- [MediaFire / MEGA mirrors listed there](https://oldgamesdownload.com/file/eecd488e-851f-47bb-8118-e19365ea63b6/)
- [Independent archive listing](https://www.myabandonware.com/game/empire-wargame-of-the-century-ap) (the original DOS version must not be confused with the downloadable earlier version 5.0).

The v2.05C disk listing provides a concrete expected **EMPIRE.EXE length of 222,673 bytes**. This is a useful screening check, not authentication.

### Retrieval result

The archive's file page and mirror selections were identified via text-based browsing. The extraction environment cannot resolve the download host, and the archive mirrors are interactive, so **no executable bytes have been retrieved or examined**. No disassembly, generator recurrence, or time-seeding mechanism has therefore been established.

The archive may be obtainable by downloading its ZIP to a personal computer or iPad and attaching it privately to the analysis conversation. The binary should not be added to this public repository.

### Focused executable-analysis checklist

- Validate ZIP member list and EMPIRE.EXE size; hash every candidate to distinguish release builds.
- Detect executable packing before trusting disassembly addresses.
- Locate calls into timer APIs (BIOS INT 1Ah, DOS INT 21h/AH 2Ch, BIOS tick at 0040:006C) and identify when they execute.
- Trace **combat**, **city attack**, and **AI decision** sites *backward* into random-number calls rather than assuming every timer call is seeding.
- Distinguish seed-at-startup, seed-at-each-attack, and timer-as-random-output hypotheses.
- Use repeated save-state tests, both without pauses and with timed delays, to falsify hypotheses.
- Do not switch Empirata's RNG until an observed sequence and call order can be matched.

A player's report about attack timing is an observation only; it is not sufficient proof of a clock-based generator.
