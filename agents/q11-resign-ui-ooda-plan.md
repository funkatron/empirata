# Q11 OODA plan — ALG-AI-004 resign accept/decline UI (2026-11-16)

## Observe
- Q10 landed predicates + `classicResignOffered`; executor logged a placeholder string.
- DOS copy: “Do you accept?”; decline keeps `4F8` set; accept zeroes computer city tally and elimination bookkeeping.

## Orient
- Engine needs durable `classicResignPending` until the human acts; save/load must round-trip.
- UI: modal on blue turn when pending; block `advanceLabRound` until resolved.

## Decide
- Accept → all `computer` cities → `human`, remove `computer` units, clear pending.
- Decline → clear pending only; `classicResignOffered` stays (no re-offer).
- Lab UI wired via `resignDialog` + `respondClassicResign`.

## Act
- PR `cursor/q11-resign-ui-85b7` on `main`.