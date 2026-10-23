# Interstel DOS 2.05C binary inspection — 2026-10-22

The user supplied an authentic-sized original archive privately. **Do not upload the executable or original assets to this public repository.**

## Verified executable

- Name: `EMPIRE.EXE`
- Length: **222,673 bytes** (matches historical v2.05C listing).
- SHA-256: `0304d332df59ea57b58d15a43780583acdab34981c037a60a1c82364b18b5ca9`
- DOS MZ executable, 512-byte header, zero MZ relocation records; entry `CS:IP=33F4:0010`, initial `SS:SP=39CF:0080`.

## Disassembly evidence

Literal BIOS timer `INT 1Ah` calls in 16-bit x86 machine code:

- File `0x1A9AD`: reads system ticks before a delay/calibration loop.
- File `0x1AA25`: reads ticks after the loop, apparently measuring elapsed time.
- File `0x1AB19`: reads ticks and transforms the low 16 bits as follows:

```asm
push ax
push dx
mov ah, 0
int 1Ah
add dx, 0x9248
ror dx, 1
mov cx, dx
pop dx
pop ax
ret
```

**Important:** The last helper is a plausible source of clock-derived values, not a demonstrated RNG. Its callers and role remain unknown. Two nearby timer calls appear to implement timing calibration, so clock use alone cannot establish time-based combat randomness.

No exact `MOV AH,2Ch; INT 21h` byte signature appeared. Simple scans for several common 32-bit linear-congruential constants also found no matches, neither of which proves a particular algorithm absent.

## Research next steps

1. Map segments/overlays and trace every caller to the helper at file offset `0x1AB15`.
2. Locate combat and city-assault routines and trace all sources of random outcomes.
3. Instrument original behavior in a DOS-compatible debugger: compare repeated attacks, varying delays, and save/reload traces.
4. Reproduce the identified generator and random-draw consumption in TypeScript, verifying sequences before changing gameplay.

**Status: authentic binary obtained and statically inspected; exact RNG not recovered.** The existing Empirata PRNG remains unchanged.

## Follow-up: the BIOS timer helper is used by the PC speaker (2026-10-22)

A caller trace of the raw 16-bit code found a single direct same-segment relative call to `0x1AB15`, at `0x1ABB8`. The immediately following call at `0x1ABBB` targets `0x1AB01`, which scales `CX` into a range stored in `DS:[0x10]` and `DS:[0x12]`.

Disassembly of the enclosing function (`0x1ABAF`) shows:

```asm
mov al, 0xB6
out 0x43, al         ; configure PIT channel 2
call 0x1AB15        ; obtain timer-derived CX
call 0x1AB01        ; transform/scale CX
mov di, cx
mov dx, 0x0014
mov ax, 0x4F38
div di                ; speaker frequency divisor
out 0x42, al         ; write PIT channel 2 divisor (low byte)
mov al, ah
out 0x42, al         ; high byte
in  al, 0x61
or  al, 3
out 0x61, al         ; enable PC speaker
; subsequent delay-loop and speaker disable omitted
```

The surrounding entry (`0x1AB85`) sets up range variables and plays this sequence five times. This makes **sound generation** substantially more likely than combat random-number generation as the purpose of the clock helper. Do not interpret the `0x1AB15` transformation as the original combat RNG. Caller scanning only covers direct near calls and cannot rule out indirect dispatch, but the positive hardware evidence is strong.

**Updated RNG status:** The verified original executable is available for further offline inspection; the original combat RNG remains **unknown**. Focus next on locating the combat resolver independently (call graph, unit hit-point updates, city capture, traces under DOSBox debugger) and then tracing its entropy/random calls.
