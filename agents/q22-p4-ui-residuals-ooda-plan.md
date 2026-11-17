# Q22 OODA — P4 UI residuals (gesture / ui-load)

## Observe
- P4 audit: fit-world, pinch-zoom in source; acceptance gaps on iPad profiles.
- Playwright `capture-production` stays opt-in per roadmap item 9.

## Decide
- Tighten `tests/ui-camera.test.mjs` or smoke assertions if gaps found.
- Manual computerUse pass only if VM has executor; otherwise document checklist.

## Act
- Branch `cursor/q22-p4-ui-residuals-85b7` → patch semver if user-visible.