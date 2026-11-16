/** Viewport tile scale helpers (pure math for tests and map camera). */

export function fitTileSize(
  viewWidth: number,
  viewHeight: number,
  worldWidth: number,
  worldHeight: number,
): number {
  if (worldWidth <= 0 || worldHeight <= 0) return 1;
  return Math.min(viewWidth / worldWidth, viewHeight / worldHeight);
}

/** Largest tile size: scales with viewport; 45px minimum keeps small-phone usability. */
export function maxTileSize(viewWidth: number, viewHeight: number): number {
  const side = Math.min(viewWidth, viewHeight);
  return Math.max(45, side * 0.85);
}

export function clampTileSize(
  tileSize: number,
  viewWidth: number,
  viewHeight: number,
  worldWidth: number,
  worldHeight: number,
): number {
  const min = fitTileSize(viewWidth, viewHeight, worldWidth, worldHeight);
  const max = maxTileSize(viewWidth, viewHeight);
  return Math.max(min, Math.min(max, tileSize));
}

/** Tiles too small for precise unit/city selection (overview / fit-world scale). */
export function isOverviewTileScale(
  tileSize: number,
  viewWidth: number,
  viewHeight: number,
  worldWidth: number,
  worldHeight: number,
  minReadable = 16,
): boolean {
  const fit = fitTileSize(viewWidth, viewHeight, worldWidth, worldHeight);
  if (tileSize < minReadable) return true;
  return tileSize <= fit * 1.05;
}

/** Target scale after overview tap — zoom toward a readable cell without jumping to max. */
export function zoomInForMapTap(
  tileSize: number,
  viewWidth: number,
  viewHeight: number,
  worldWidth: number,
  worldHeight: number,
): number {
  const fit = fitTileSize(viewWidth, viewHeight, worldWidth, worldHeight);
  const target = Math.max(tileSize * 2.5, fit * 2.2, 22);
  return clampTileSize(target, viewWidth, viewHeight, worldWidth, worldHeight);
}
