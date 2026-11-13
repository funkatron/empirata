/**
 * Empirata map recipe: enough fields to regenerate a campaign start.
 * Not a mid-game save; full games still use exportSave / importSave.
 */
import type {CityDensity, CampaignLayout, MapAlgorithm} from './mapgen.js';

export const MAP_RECIPE_KIND = 'empirata-map-recipe' as const;

export type MapRecipe = {
  kind: typeof MAP_RECIPE_KIND;
  version: 1;
  layout: CampaignLayout;
  seed: number;
  algorithm: MapAlgorithm;
  density: CityDensity;
};

const LAYOUTS: ReadonlyArray<CampaignLayout> = ['continents', 'islands', 'archipelago'];
const ALGORITHMS: ReadonlyArray<MapAlgorithm> = ['ellipse-v1', 'organic-v1'];
const DENSITIES: ReadonlyArray<CityDensity> = ['sparse', 'standard'];

export function isCampaignLayout(value: unknown): value is CampaignLayout {
  return typeof value === 'string' && (LAYOUTS as readonly string[]).includes(value);
}

export function isMapAlgorithm(value: unknown): value is MapAlgorithm {
  return typeof value === 'string' && (ALGORITHMS as readonly string[]).includes(value);
}

export function isCityDensity(value: unknown): value is CityDensity {
  return typeof value === 'string' && (DENSITIES as readonly string[]).includes(value);
}

/** Positive 32-bit integer seed accepted by makeCampaignMap. */
export function parseCampaignSeed(value: unknown): number | null {
  if (typeof value === 'number') {
    if (!Number.isInteger(value) || value < 1 || value > 0xffffffff) return null;
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1 || n > 0xffffffff) return null;
    return n;
  }
  return null;
}

/** Random seed for “random on start”; not used for in-game combat RNG. */
export function randomCampaignSeed(): number {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    const n = buf[0]! >>> 0;
    return n === 0 ? 1 : n;
  }
  const n = (Date.now() ^ (Math.floor(Math.random() * 0xffffffff))) >>> 0;
  return n === 0 ? 1 : n;
}

export function formatMapSeedLine(recipe: Pick<MapRecipe, 'layout' | 'algorithm' | 'density' | 'seed'>): string {
  return `${recipe.layout} · ${recipe.algorithm} · ${recipe.density} · seed ${recipe.seed}`;
}

export function serializeMapRecipe(recipe: MapRecipe): string {
  return JSON.stringify(recipe, null, 2);
}

export function parseMapRecipe(json: string): MapRecipe {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('Map recipe is not valid JSON.');
  }
  if (typeof data !== 'object' || data === null) throw new Error('Map recipe must be an object.');
  const raw = data as Record<string, unknown>;
  if (raw.kind !== MAP_RECIPE_KIND) {
    throw new Error('Not an Empirata map recipe. Use Import JSON for full game saves.');
  }
  if (raw.version !== 1) throw new Error('Unsupported map recipe version.');
  if (!isCampaignLayout(raw.layout)) throw new Error('Map recipe has an invalid layout.');
  if (!isMapAlgorithm(raw.algorithm)) throw new Error('Map recipe has an invalid algorithm.');
  if (!isCityDensity(raw.density)) throw new Error('Map recipe has an invalid density.');
  const seed = parseCampaignSeed(raw.seed);
  if (seed === null) throw new Error('Map recipe has an invalid seed.');
  return {
    kind: MAP_RECIPE_KIND,
    version: 1,
    layout: raw.layout,
    seed,
    algorithm: raw.algorithm,
    density: raw.density,
  };
}

export function mapRecipeFromCampaign(campaign: {
  layout: CampaignLayout;
  seed: number;
  algorithm?: MapAlgorithm;
  density?: CityDensity;
}): MapRecipe {
  return {
    kind: MAP_RECIPE_KIND,
    version: 1,
    layout: campaign.layout,
    seed: campaign.seed,
    algorithm: campaign.algorithm ?? 'ellipse-v1',
    density: campaign.density ?? 'sparse',
  };
}
