# Empirata — RNG Investigation Follow-up (2026-10-22)

Original Interstel v2.05C executable `EMPIRE.EXE` (222,673 bytes), SHA-256 `0304d332df59ea57b58d15a43780583acdab34981c037a60a1c82364b18b5ca9`. The commercial executable stays private.

## Confirmed results

The helper at `0x1AB15` and its caller use the PC speaker/PIT pathway (ports `0x43`, `0x42`, `0x61`), so they are **not evidence of the combat RNG**.

Further literal-byte scanning identified the three adjacent BIOS timer-read patterns `B4 00 CD 1A` at file offsets `0x1A9AB`, `0x1AA23`, and `0x1AB17`—the already investigated hardware timing area.

No exact adjacent `B4 2C CD 21` DOS time-of-day pattern, adjacent `B4 2A CD 21` date pattern, or two probed 32-bit multiplier constants (`FD 43 03 00` and `6D 4E C6 41`) were found.

**Caution:** Raw-byte absence is not proof that these services or arithmetic families are absent. Register loads may be separated, indirect calls used, data/code mixed or segmented, or another algorithm implemented. Raw file offsets are not trustworthy function boundaries by themselves.

## Next decisive experiment

- Use a 16-bit DOS debugger, break on changes to unit hit points or city ownership, and trace backward to random decisions.
- Capture calls and state in repeated combat from identical saved conditions, with and without deliberate delay.
- Validate candidate generator with captured internal state and at least 10 consecutive outputs, then reconstruct the draw ordering.
- Do not adopt any generator in Empirata until experimentally verified.

**Status:** Exact original combat RNG remains unidentified.