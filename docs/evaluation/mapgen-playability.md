# Organic-v1 playability checklist

Testable constraints for Empirata procedural campaign maps (`algorithm: 'organic-v1'`).
These are **Empirata lab rules**, inspired by Interstel manual validator spirit (especially lake-trapped ports). They are not a claim of DOS editor parity.

Implemented in [`src/engine/mapgen.ts`](../../src/engine/mapgen.ts) and locked by [`tests/mapgen.test.mjs`](../../tests/mapgen.test.mjs).

## Terrain generation

1. Seeded value-noise fBm with domain warping; layout parameter packs for `continents`, `islands`, `archipelago`.
2. Outer border remains sea / impassable.
3. Morphological cleanup removes tiny islands and tiny inland lakes.
4. Threshold nudge loop (deterministic offsets) retries until playability passes or best attempt is kept.

## Validator (`analyzePlayability`)

| Check | Rule |
|---|---|
| Land fraction | Inside layout band (continents ≈ 28–50%, islands ≈ 16–36%, archipelago ≈ 10–30% of playable cells) |
| Land components | Count of landmasses ≥ `minLandComponent` cells within layout band (continents may be a single mass) |
| Main ocean | Largest sea component touching the map border; size ≥ 55% of all sea cells |
| City candidates | Enough land cells (coastal-only for islands/archipelago) that are not lake-trapped ports |
| Lake-port ban | A coastal city candidate must touch a sea cell in the **main ocean** component |

## City profiles

| Density | Target count | Default spacing (Chebyshev) |
|---|---:|---:|
| `sparse` | 12 | 7 |
| `standard` | 64 | 3 |

Starts: farthest pair among placed cities; organic maps prefer pairs whose landmasses have ocean-port opportunity.

## Start / diagnostics metrics

Reuse / extend [`scripts/diagnose-study-maps.mjs`](../../scripts/diagnose-study-maps.mjs):

- Land component count
- Whether each faction start is coastal
- Cities and port cities on the start landmass
- Whether port access is physically possible on that landmass
- Terrain hash + `campaignMap.algorithm` / `density` when present

## Preview spike

```bash
npm run build
node scripts/preview-organic-maps.mjs
```

Writes ASCII/PGM comparisons under `docs/evaluation/mapgen-previews/` (local artifacts; not required in CI).

## Non-goals

- Interstel `.MAP` bit identity
- Elevations, rivers, or non-binary terrain
- Replacing frozen 42-campaign ellipse baseline hashes
