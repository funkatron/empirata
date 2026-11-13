/**
 * Empirata campaign map generation.
 * organic-v1: OpenSimplex-style value noise + fBm + domain warp, then playability validation.
 * ellipse-v1: legacy random ellipses (frozen study baseline reproducibility).
 * Not Interstel .MAP / editor parity.
 */
import type {Coord, Game, Terrain} from './types.js';
import {directions, isCoastal, MAP_HEIGHT, MAP_WIDTH} from './world.js';

export type CampaignLayout = 'continents' | 'islands' | 'archipelago';
export type MapAlgorithm = 'ellipse-v1' | 'organic-v1';
export type CityDensity = 'sparse' | 'standard';

export type MapgenOptions = {
  algorithm?: MapAlgorithm;
  density?: CityDensity;
  cityCount?: number;
  minSpacing?: number;
  requireStartPortOpportunity?: boolean;
};

export type PlayabilityReport = {
  ok: boolean;
  reasons: string[];
  landFraction: number;
  landComponents: number;
  oceanSize: number;
  seaSize: number;
  playableCells: number;
  cityCandidates: number;
};

export type GeneratedTerrain = {
  tiles: Terrain[];
  report: PlayabilityReport;
  attempts: number;
};

const PLAYABLE = (MAP_WIDTH - 2) * (MAP_HEIGHT - 2);

type LayoutNoise = {
  scale: number;
  octaves: number;
  persistence: number;
  warp: number;
  threshold: number;
  radialFalloff: number;
  landTarget: [number, number];
  landComponents: [number, number];
  minLandComponent: number;
  minIslandSize: number;
  minLakeSize: number;
};

const LAYOUT_NOISE: Record<CampaignLayout, LayoutNoise> = {
  continents: {
    scale: 0.032, octaves: 4, persistence: 0.5, warp: 10, threshold: 0.02,
    radialFalloff: 0.22, landTarget: [0.28, 0.50], landComponents: [1, 12],
    minLandComponent: 60, minIslandSize: 10, minLakeSize: 8,
  },
  islands: {
    scale: 0.052, octaves: 3, persistence: 0.55, warp: 14, threshold: 0.06,
    radialFalloff: 0.32, landTarget: [0.16, 0.36], landComponents: [4, 32],
    minLandComponent: 18, minIslandSize: 6, minLakeSize: 5,
  },
  archipelago: {
    scale: 0.078, octaves: 3, persistence: 0.62, warp: 20, threshold: 0.1,
    radialFalloff: 0.38, landTarget: [0.10, 0.30], landComponents: [8, 70],
    minLandComponent: 6, minIslandSize: 3, minLakeSize: 3,
  },
};

const DENSITY_DEFAULTS: Record<CityDensity, {cityCount: number; minSpacing: number}> = {
  sparse: {cityCount: 12, minSpacing: 7},
  standard: {cityCount: 64, minSpacing: 3},
};

/** Deterministic xorshift32 in [0, 1). */
export function makeMapRandom(seed: number): () => number {
  let state = (seed >>> 0) || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

function hash2(ix: number, iy: number, seed: number): number {
  let n = (ix * 374761393 + iy * 668265263 + seed * 1442695041) | 0;
  n = (n ^ (n >>> 13)) * 1274126177;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Smooth value noise in roughly [-0.5, 0.5]. */
function valueNoise2(x: number, y: number, seed: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = fade(x - x0);
  const fy = fade(y - y0);
  const v00 = hash2(x0, y0, seed);
  const v10 = hash2(x0 + 1, y0, seed);
  const v01 = hash2(x0, y0 + 1, seed);
  const v11 = hash2(x0 + 1, y0 + 1, seed);
  return lerp(lerp(v00, v10, fx), lerp(v01, v11, fx), fy) - 0.5;
}

function fbm(x: number, y: number, seed: number, octaves: number, persistence: number): number {
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += valueNoise2(x * freq, y * freq, seed + o * 1013) * amp;
    norm += amp;
    amp *= persistence;
    freq *= 2;
  }
  return sum / norm;
}

function radialBias(x: number, y: number, width: number, height: number, falloff: number): number {
  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;
  const dx = (x - cx) / cx;
  const dy = (y - cy) / cy;
  const r = Math.sqrt(dx * dx + dy * dy);
  return 1 - falloff * Math.min(1, r * r);
}

export function generateOrganicHeight(
  layout: CampaignLayout,
  seed: number,
  width = MAP_WIDTH,
  height = MAP_HEIGHT,
): Float64Array {
  const cfg = LAYOUT_NOISE[layout];
  const field = new Float64Array(width * height);
  // Stronger ridge carving on multi-island layouts splits landmasses naturally.
  const ridgeStrength = layout === 'continents' ? 0.18 : layout === 'islands' ? 0.32 : 0.45;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
        field[y * width + x] = -1;
        continue;
      }
      const wx = fbm(x * cfg.scale * 0.7, y * cfg.scale * 0.7, seed + 17, 2, 0.5) * cfg.warp;
      const wy = fbm(x * cfg.scale * 0.7 + 50, y * cfg.scale * 0.7 + 50, seed + 91, 2, 0.5) * cfg.warp;
      const n = fbm(x * cfg.scale + wx * 0.01, y * cfg.scale + wy * 0.01, seed, cfg.octaves, cfg.persistence);
      const ridge = Math.abs(fbm(x * cfg.scale * 1.6, y * cfg.scale * 1.6, seed + 401, 2, 0.5));
      const carved = n - ridgeStrength * (0.35 - ridge);
      field[y * width + x] = carved * radialBias(x, y, width, height, cfg.radialFalloff);
    }
  }
  return field;
}

function floodSizes(
  tiles: Terrain[],
  width: number,
  height: number,
  want: Terrain,
): {sizes: number[]; label: Int32Array; count: number} {
  const label = new Int32Array(tiles.length).fill(-1);
  const sizes: number[] = [];
  let count = 0;
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i] !== want || label[i] !== -1) continue;
    const queue = [i];
    label[i] = count;
    let size = 0;
    for (let at = 0; at < queue.length; at++) {
      const cur = queue[at]!;
      size++;
      const x = cur % width;
      const y = (cur / width) | 0;
      for (const d of directions) {
        const nx = x + d.x;
        const ny = y + d.y;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const ni = ny * width + nx;
        if (tiles[ni] !== want || label[ni] !== -1) continue;
        label[ni] = count;
        queue.push(ni);
      }
    }
    sizes.push(size);
    count++;
  }
  return {sizes, label, count};
}

function removeSmallComponents(
  tiles: Terrain[],
  width: number,
  height: number,
  want: Terrain,
  fill: Terrain,
  minSize: number,
): void {
  const {sizes, label} = floodSizes(tiles, width, height, want);
  for (let i = 0; i < tiles.length; i++) {
    const id = label[i]!;
    if (id >= 0 && sizes[id]! < minSize) tiles[i] = fill;
  }
}

export function cleanupTerrain(
  tiles: Terrain[],
  layout: CampaignLayout,
  width = MAP_WIDTH,
  height = MAP_HEIGHT,
): void {
  const cfg = LAYOUT_NOISE[layout];
  removeSmallComponents(tiles, width, height, 'land', 'sea', cfg.minIslandSize);
  removeSmallComponents(tiles, width, height, 'sea', 'land', cfg.minLakeSize);
  // Keep outer border sea.
  for (let x = 0; x < width; x++) {
    tiles[x] = 'sea';
    tiles[(height - 1) * width + x] = 'sea';
  }
  for (let y = 0; y < height; y++) {
    tiles[y * width] = 'sea';
    tiles[y * width + width - 1] = 'sea';
  }
}

/** Largest sea component that touches the impassable border is the ocean. */
export function mainOceanLabel(
  tiles: Terrain[],
  width = MAP_WIDTH,
  height = MAP_HEIGHT,
): {label: Int32Array; oceanId: number; oceanSize: number; seaSize: number} {
  const {sizes, label} = floodSizes(tiles, width, height, 'sea');
  let oceanId = -1;
  let oceanSize = 0;
  let seaSize = 0;
  for (const size of sizes) seaSize += size;
  for (let x = 0; x < width; x++) {
    for (const y of [0, height - 1]) {
      const id = label[y * width + x]!;
      if (id >= 0 && sizes[id]! > oceanSize) {
        oceanId = id;
        oceanSize = sizes[id]!;
      }
    }
  }
  for (let y = 0; y < height; y++) {
    for (const x of [0, width - 1]) {
      const id = label[y * width + x]!;
      if (id >= 0 && sizes[id]! > oceanSize) {
        oceanId = id;
        oceanSize = sizes[id]!;
      }
    }
  }
  return {label, oceanId, oceanSize, seaSize};
}

export function analyzePlayability(
  tiles: Terrain[],
  layout: CampaignLayout,
  cityCount: number,
  width = MAP_WIDTH,
  height = MAP_HEIGHT,
): PlayabilityReport {
  const cfg = LAYOUT_NOISE[layout];
  const reasons: string[] = [];
  let land = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (tiles[y * width + x] === 'land') land++;
    }
  }
  const landFraction = land / PLAYABLE;
  const landFlood = floodSizes(tiles, width, height, 'land');
  const meaningful = landFlood.sizes.filter(s => s >= cfg.minLandComponent).length;
  const ocean = mainOceanLabel(tiles, width, height);
  const world = {width, height, tiles};
  let cityCandidates = 0;
  for (let y = 2; y < height - 2; y++) {
    for (let x = 2; x < width - 2; x++) {
      if (tiles[y * width + x] !== 'land') continue;
      const p = {x, y};
      if (layout !== 'continents' && !isCoastal(world, p)) continue;
      if (!touchesMainOcean(world, p, ocean.label, ocean.oceanId)) continue;
      cityCandidates++;
    }
  }
  if (landFraction < cfg.landTarget[0] || landFraction > cfg.landTarget[1]) {
    reasons.push(`landFraction ${landFraction.toFixed(3)} outside ${cfg.landTarget[0]}–${cfg.landTarget[1]}`);
  }
  if (meaningful < cfg.landComponents[0] || meaningful > cfg.landComponents[1]) {
    reasons.push(`landComponents ${meaningful} outside ${cfg.landComponents[0]}–${cfg.landComponents[1]}`);
  }
  if (ocean.oceanId < 0 || ocean.oceanSize < ocean.seaSize * 0.55) {
    reasons.push('main ocean is too small relative to all sea');
  }
  if (cityCandidates < cityCount) {
    reasons.push(`cityCandidates ${cityCandidates} < requested ${cityCount}`);
  }
  return {
    ok: reasons.length === 0,
    reasons,
    landFraction,
    landComponents: meaningful,
    oceanSize: ocean.oceanSize,
    seaSize: ocean.seaSize,
    playableCells: PLAYABLE,
    cityCandidates,
  };
}

function touchesMainOcean(
  world: {width: number; height: number; tiles: Terrain[]},
  p: Coord,
  seaLabel: Int32Array,
  oceanId: number,
): boolean {
  if (oceanId < 0) return false;
  if (!isCoastal(world, p)) return true; // inland city: lake-port rule N/A
  return directions.some(d => {
    const q = {x: p.x + d.x, y: p.y + d.y};
    if (q.x < 0 || q.y < 0 || q.x >= world.width || q.y >= world.height) return false;
    return world.tiles[q.y * world.width + q.x] === 'sea' && seaLabel[q.y * world.width + q.x] === oceanId;
  });
}

export function thresholdHeight(
  field: Float64Array,
  threshold: number,
  width = MAP_WIDTH,
  height = MAP_HEIGHT,
): Terrain[] {
  const tiles: Terrain[] = Array.from({length: width * height}, () => 'sea');
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (field[y * width + x]! > threshold) tiles[y * width + x] = 'land';
    }
  }
  return tiles;
}

export function generateOrganicTerrain(
  layout: CampaignLayout,
  seed: number,
  cityCount: number,
): GeneratedTerrain {
  const cfg = LAYOUT_NOISE[layout];
  let best: {tiles: Terrain[]; report: PlayabilityReport; attempts: number} | null = null;
  const thresholdOffsets = [0, -0.04, 0.04, -0.08, 0.08, -0.12, 0.12];
  const seedOffsets = [0, 9973, 19727, 31469];
  let attempts = 0;
  for (const seedOffset of seedOffsets) {
    const field = generateOrganicHeight(layout, (seed + seedOffset) >>> 0 || 1);
    for (const thresholdOffset of thresholdOffsets) {
      attempts++;
      const tiles = thresholdHeight(field, cfg.threshold + thresholdOffset);
      cleanupTerrain(tiles, layout);
      const report = analyzePlayability(tiles, layout, cityCount);
      if (!best || report.reasons.length < best.report.reasons.length ||
        (report.reasons.length === best.report.reasons.length &&
          Math.abs(report.landFraction - (cfg.landTarget[0] + cfg.landTarget[1]) / 2) <
          Math.abs(best.report.landFraction - (cfg.landTarget[0] + cfg.landTarget[1]) / 2))) {
        best = {tiles, report, attempts};
      }
      if (report.ok) return {tiles, report, attempts};
    }
  }
  return best!;
}

/**
 * Legacy ellipse terrain + city placement with one sequential RNG stream.
 * Must stay bit-identical to pre-organic campaign maps for study replay.
 */
export function generateEllipseCampaign(
  layout: CampaignLayout,
  seed: number,
  cityCount: number,
  minSpacing: number,
  width = MAP_WIDTH,
  height = MAP_HEIGHT,
): {tiles: Terrain[]; positions: Coord[]; pair: [number, number]} {
  const random = makeMapRandom(seed);
  const tiles: Terrain[] = Array.from({length: width * height}, () => 'sea');
  const config: Record<CampaignLayout, [number, number, number]> = {
    continents: [7, 18, 13],
    islands: [16, 10, 8],
    archipelago: [32, 5, 4],
  };
  const [count, rx, ry] = config[layout];
  for (let i = 0; i < count; i++) {
    const cx = 5 + random() * (width - 10);
    const cy = 5 + random() * (height - 10);
    const a = rx * (0.6 + random() * 0.8);
    const b = ry * (0.6 + random() * 0.8);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        if (((x - cx) / a) ** 2 + ((y - cy) / b) ** 2 < 1) tiles[y * width + x] = 'land';
      }
    }
  }
  const world = {width, height, tiles};
  const candidates: Coord[] = [];
  for (let y = 2; y < height - 2; y++) {
    for (let x = 2; x < width - 2; x++) {
      if (tiles[y * width + x] === 'land') candidates.push({x, y});
    }
  }
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const tmp = candidates[i]!;
    candidates[i] = candidates[j]!;
    candidates[j] = tmp;
  }
  const distance = (a: Coord, b: Coord) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  const positions: Coord[] = [];
  for (const p of candidates) {
    if (layout !== 'continents' && !isCoastal(world, p)) continue;
    if (positions.every(q => distance(p, q) >= minSpacing)) positions.push(p);
    if (positions.length === cityCount) break;
  }
  if (positions.length < 4) throw new Error(`Insufficient cities: ${layout}/${seed}`);
  let pair: [number, number] = [0, 1];
  for (let a = 0; a < positions.length; a++) {
    for (let b = a + 1; b < positions.length; b++) {
      if (distance(positions[a]!, positions[b]!) > distance(positions[pair[0]]!, positions[pair[1]]!)) {
        pair = [a, b];
      }
    }
  }
  return {tiles, positions, pair};
}

/** Ellipse tiles only (preview / diagnostics). */
export function generateEllipseTerrain(
  layout: CampaignLayout,
  seed: number,
  width = MAP_WIDTH,
  height = MAP_HEIGHT,
): Terrain[] {
  return generateEllipseCampaign(layout, seed, 12, 7, width, height).tiles;
}

export function placeCampaignCities(
  tiles: Terrain[],
  layout: CampaignLayout,
  seed: number,
  options: {
    cityCount: number;
    minSpacing: number;
    requireOceanPorts?: boolean;
    random?: () => number;
  },
): {positions: Coord[]; pair: [number, number]} {
  const width = MAP_WIDTH;
  const height = MAP_HEIGHT;
  const random = options.random ?? makeMapRandom(seed ^ 0xC0FFEE);
  const world = {width, height, tiles};
  const ocean = mainOceanLabel(tiles, width, height);
  const candidates: Coord[] = [];
  for (let y = 2; y < height - 2; y++) {
    for (let x = 2; x < width - 2; x++) {
      if (tiles[y * width + x] !== 'land') continue;
      const p = {x, y};
      if (layout !== 'continents' && !isCoastal(world, p)) continue;
      if (options.requireOceanPorts && isCoastal(world, p) &&
        !touchesMainOcean(world, p, ocean.label, ocean.oceanId)) continue;
      candidates.push(p);
    }
  }
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const tmp = candidates[i]!;
    candidates[i] = candidates[j]!;
    candidates[j] = tmp;
  }
  const distance = (a: Coord, b: Coord) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  const positions: Coord[] = [];
  for (const p of candidates) {
    if (positions.every(q => distance(p, q) >= options.minSpacing)) positions.push(p);
    if (positions.length === options.cityCount) break;
  }
  if (positions.length < 4) {
    throw new Error(`Insufficient cities: ${layout}/${seed} (${positions.length})`);
  }
  let pair: [number, number] = [0, 1];
  for (let a = 0; a < positions.length; a++) {
    for (let b = a + 1; b < positions.length; b++) {
      if (distance(positions[a]!, positions[b]!) > distance(positions[pair[0]]!, positions[pair[1]]!)) {
        pair = [a, b];
      }
    }
  }
  if (options.requireOceanPorts) {
    const landFlood = floodSizes(tiles, width, height, 'land');
    const portOk = (idx: number) => {
      const start = positions[idx]!;
      const component = landFlood.label[start.y * width + start.x]!;
      for (let i = 0; i < tiles.length; i++) {
        if (landFlood.label[i] !== component) continue;
        const p = {x: i % width, y: (i / width) | 0};
        if (isCoastal(world, p) && touchesMainOcean(world, p, ocean.label, ocean.oceanId)) return true;
      }
      return false;
    };
    if (!portOk(pair[0]) || !portOk(pair[1])) {
      let best: [number, number] | null = null;
      let bestDist = -1;
      for (let a = 0; a < positions.length; a++) {
        if (!portOk(a)) continue;
        for (let b = a + 1; b < positions.length; b++) {
          if (!portOk(b)) continue;
          const dist = distance(positions[a]!, positions[b]!);
          if (dist > bestDist) {
            bestDist = dist;
            best = [a, b];
          }
        }
      }
      if (best) pair = best;
    }
  }
  return {positions, pair};
}

export function resolveMapgenOptions(options: MapgenOptions = {}): {
  algorithm: MapAlgorithm;
  density: CityDensity;
  cityCount: number;
  minSpacing: number;
  requireStartPortOpportunity: boolean;
} {
  const algorithm = options.algorithm ?? 'ellipse-v1';
  const density = options.density ?? 'sparse';
  const defaults = DENSITY_DEFAULTS[density];
  return {
    algorithm,
    density,
    cityCount: options.cityCount ?? defaults.cityCount,
    minSpacing: options.minSpacing ?? defaults.minSpacing,
    requireStartPortOpportunity: options.requireStartPortOpportunity ?? algorithm === 'organic-v1',
  };
}

/** ASCII preview for spike / diagnostics (land=# sea=.). */
export function tilesToAscii(tiles: Terrain[], width = MAP_WIDTH, height = MAP_HEIGHT): string {
  const lines: string[] = [];
  for (let y = 0; y < height; y++) {
    let line = '';
    for (let x = 0; x < width; x++) line += tiles[y * width + x] === 'land' ? '#' : '.';
    lines.push(line);
  }
  return lines.join('\n');
}

/** Binary PGM for quick visual diffs without image dependencies. */
export function tilesToPgm(tiles: Terrain[], width = MAP_WIDTH, height = MAP_HEIGHT): string {
  const body: string[] = [`P2`, `${width} ${height}`, `1`];
  for (let y = 0; y < height; y++) {
    const row: string[] = [];
    for (let x = 0; x < width; x++) row.push(tiles[y * width + x] === 'land' ? '1' : '0');
    body.push(row.join(' '));
  }
  return body.join('\n') + '\n';
}

/** Attach cities onto an existing empty campaign shell game. */
export function applyCitiesToGame(
  g: Game,
  positions: Coord[],
  pair: [number, number],
  swap: boolean,
): void {
  g.cities = positions.map((position, i) => ({
    id: `generated-${i}`,
    position,
    owner: i === pair[0] ? (swap ? 'red' : 'blue') : i === pair[1] ? (swap ? 'blue' : 'red') : null,
    production: null,
    progress: 0,
    firstCycle: true,
  }));
}
