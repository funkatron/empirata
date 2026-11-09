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
