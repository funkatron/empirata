# Q16 OODA plan — slice C ALG-AI-001 depth (2026-11-16)

## Observe
- Passability is a single heuristic; grade B only tweaks strictSea for non-transports.
- Classic executor ignores escort, load-ship standing orders during the activation pass.

## Orient
- One PR: mask profiles (army/fighter/ship-a/ship-b), escort stationing step, transport order sanitization + load-ship hold.
- Still one step per unit per pass; reuse `moveUnit` / `loadShip`.

## Decide
- **Ship B:** block coastal-sea tiles for non-transport hulls (grade 2 `62FA` analogue).
- **Escort:** route toward a Chebyshev-1 station tile beside the escort target.
- **Load:** no movement while `load-ship`; empty transport clears non-load tactical orders.

## Act
- PR `cursor/q16-alg-ai-001-depth-85b7`; slice **C** → v0.5.4 patch.