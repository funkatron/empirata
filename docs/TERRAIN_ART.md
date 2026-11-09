# Terrain artwork implementation

This is a **rendering-only** feature. The game engine still recognizes only land and sea; forests, hills, and beaches are decorative and must not affect movement, production, combat, or AI decisions.

## Source assets
- `public/terrain-atlas.png`: 256 × 64 RGBA PNG; 32 × 32 cells; row 0 has eight land variations (including forest and hill motifs); row 1 has eight sea variations.
- `src/ui/map-art.ts`: chooses an atlas sprite deterministically from map coordinates and uses nearest-neighbor scaling. Unit and city silhouettes are separate layers.
- `public/terrain-showcase.html`: standalone, fully revealed synthetic archipelago for evaluating actual sprites in a coherent map, without fog-of-war. Use `npm run build` and open `/terrain-showcase.html` from the local server.
- `smoke/map-screenshots.mjs`: captures the showcase alongside gameplay screenshots. Full iPad matrix remains opt-in.

## Visual review checklist
- [ ] Land, sea, and shore remain clearly distinguishable at fit-world, normal, and maximum zoom
- [ ] Forest/hill silhouettes read as terrain rather than noise
- [ ] Tile repetition and shoreline joins are acceptable
- [ ] Unit and city glyphs remain legible
- [ ] Desktop and iPad screenshots reviewed by a person
- [ ] No game rule changes

The approved illustration is a **directional concept**, not an exported sprite sheet. This PNG atlas is a first implementation, not a claim of pixel-for-pixel equivalence. Refine assets through visual review before merging.