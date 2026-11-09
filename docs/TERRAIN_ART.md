# Terrain artwork implementation

This is a **rendering-only** feature. Empirata's engine recognizes land and sea. Beaches are visual boundaries only, and neither movement nor AI behavior changes.

## Core assets
- `public/terrain-atlas.svg`: a pixel-exact 256 × 64 SVG atlas containing sixteen 32 × 32 sprites: eight grassland variants and eight ocean variants. It renders with crisp pixel boundaries and nearest-neighbor scaling.
- Each variant uses identical pixels on its outer perimeter, with opposite edges matched. This allows arbitrary adjacent variants to join without seams. Interior colors and small features vary to reduce repetition.
- `src/ui/map-art.ts`: deterministic atlas selection; beach/shore overlay is independent.
- `public/terrain-showcase.html`: a fully revealed example map and four explicit 3 × 3 tile matrices: identical grass, identical ocean, mixed grass, and mixed ocean.
- `smoke/map-screenshots.mjs`: screenshots of the real game and showcase. Full device matrix remains optional.

## Visual review
- [ ] Identical 3 × 3 grass and ocean tiles show no seams
- [ ] Mixed 3 × 3 variants show no seams or conspicuous border artifacts
- [ ] Natural-looking grass and water at world fit, normal, and maximum zoom
- [ ] Coastline joins remain acceptable; beach refinement is lower priority
- [ ] Units and cities remain readable
- [ ] Desktop and iPad screenshots reviewed
- [ ] No engine or gameplay changes

The reference illustration is a **visual direction**, not a production-ready atlas. This is a new seamless texture pass, not a claim of exact pixel-for-pixel reproduction. Review the actual screenshots before merging.
