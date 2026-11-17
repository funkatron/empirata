# Q20 OODA — ALG-AI-001 `0x4462` tactical reissue (post-amphibious)

## Observe
- v0.6.3 added conquest staging; v0.6.4 sealift.
- DOS step 4 (`0x4462`) re-issues army/fighter/ship orders before direction pick; Move-To fuel gate at `0x3F64`.

## Orient
- One ALG slice per PR; do not merge full modern planners.
- Keep pass limit 1 and classic path budget.

## Decide
- `classic-reissue.ts`: when standing order tick returns “reissue”, assign charted move-to toward nearest non-friendly city (army) or go-home (fighter fuel).
- Wire before random bearing; tests against DOS doc table rows.

## Act
- Branch `cursor/q20-alg-ai-001-4462-85b7` after Q19 merge → **0.6.5** patch.