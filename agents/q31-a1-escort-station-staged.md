# Q31 A1 — escort station `1D09:03C2` staged (2026-11-23)

## Observe

- #180 shows `1D09:03C2` (`0x1D452`) loops **20** times (`mov [bp-0xa], 0x14` at `0x1D47E`) and calls `25E6:0F64` before `1A9E:006C`.
- ALG-001 already identifies `25E6:0F64` (`0x26DC4`) as Microsoft C `rand()`, not an angle table.
- The instruction sequence that turns that 15-bit result into a map index is not in the #180 excerpts. The unpacked `EMPIRE` image is not on this machine.
- v0.6.16 `classicEscortStationCandidates` walks eight chart neighbors and keeps the first reachable one (`1D09:0DF56` shape).

## Decide

Do not invent a 20-slot ring or a guessed modulo. Keep the eight-direction first-hit. Record the gap so the next trace looks for the **rand → coordinate** conversion inside `0x1D452`, not for a static angle table.

No version bump: station tiles do not change.

## Act

- Ruleset escort-station row names the call as ALG-001 and marks the conversion **[?]**.
- `tests/alg-ai-001-escort-station.test.mjs` locks candidates to Chebyshev **1** and at most **8** tiles.
- Engine comment in `src/engine/ai/classic-escort.ts` states the same limit.
