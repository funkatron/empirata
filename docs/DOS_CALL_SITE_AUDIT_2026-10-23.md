# Empirata — Original Interstel RNG audit (23 October 2026)

## Evidence and scope

Analyzed **only** the privately supplied Interstel 2.05C `EMPIRE.EXE` (222,673 bytes; SHA-256 `0304d332df59ea57b58d15a43780583acdab34981c037a60a1c82364b18b5ca9`). The original commercial executable and full raw disassembly have **not** been uploaded to the public repository.

Used `objdump -D -b binary -mi8086 -Mintel`, which decodes **the entire file as though it were code**, including the MZ header, data, and potential overlays. Addresses in this audit are **raw file offsets**, not runtime CS:IP addresses; any routine identification must be confirmed with control-flow and executable layout. Naively inferred call counts may include false positives from data.

## New results

1. The earlier suspicious BIOS timer call at file `0x1AB19` belongs to the programmable-interval-timer/PC-speaker path. It should not be used as a random-number candidate absent independent evidence.
2. Three recognizable `INT 1Ah` instruction locations remain at file offsets `0x1A9AD`, `0x1AA25`, `0x1AB19`—all within this hardware-timing neighborhood. No newly identified clock call elsewhere in the raw linear decoding.
3. The clearly decoded `INT 21h` calls in the `0x26070–0x293CA` region involve ordinary DOS services (version, file/memory management, console I/O, interrupt vector handling). The exact `MOV AH,2Ch; INT 21h` time query and `MOV AH,2Ah; INT 21h` date query patterns were not detected, but **this cannot establish that the game never reads the clock**: register setup and code/data segmentation complicate interpretation.
4. Static code around file `0x2715B–0x271F3` is **signed multiword division support** (sign handling, 16-bit `DIV`, normalization, quotient correction and `RETF 8`), **not by itself an RNG**. Therefore a concentration of `DIV` instructions in the runtime is not a reliable lead.
5. A raw whole-file instruction listing gives thousands of apparent calls to a handful of low offsets (e.g. `0x25E6`), but these include far-call segment coordinates and data. Treat high-frequency call targets as unreliable until the MZ module/segment layout is reconstructed.

## Working hypotheses (not conclusions)

- RNG initialized from a fixed seed or saved state.
- Clock-derived seed read through a library wrapper or hardware tick memory (`0040:006C`).
- RNG uses 16-bit arithmetic without recognizable 32-bit constants.
- Multiple independent entropy mechanisms, e.g. one for game rules and one for sound.

## Next decisive steps

1. Run DOS v2.05C under a 16-bit debugger / DOSBox-X debugger, capture execution around a known city assault and a conventional unit fight.
2. Find the game-state write changing hit points / unit status. Backtrace the branch governing damage assignment. Record the *caller's actual CS:IP*, and separate code from data.
3. Run the exact save state twice with identical and different delays. Record return values and potential global state writes from the suspected random function.
4. Only port to TypeScript once at least ten consecutive RNG outputs and their combat consumption are matched against the DOS program.

**Status: RNG unresolved.** This audit does not justify replacing Empirata's current generator.