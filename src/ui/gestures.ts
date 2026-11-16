import {clampTileSize} from './camera.js';

export type Point = {x: number; y: number};

export function pointerPairMidpoint(a: Point, b: Point): Point {
  return {x: (a.x + b.x) / 2, y: (a.y + b.y) / 2};
}

export function pointerPairDistance(a: Point, b: Point, min = 1): number {
  return Math.max(min, Math.hypot(a.x - b.x, a.y - b.y));
}

export type WorldAnchor = {worldX: number; worldY: number};

export function pinchWorldAnchor(
  midX: number,
  midY: number,
  rectLeft: number,
  rectTop: number,
  cameraX: number,
  cameraY: number,
  tileSize: number,
): WorldAnchor {
  return {
    worldX: (midX - rectLeft + cameraX) / tileSize,
    worldY: (midY - rectTop + cameraY) / tileSize,
  };
}

export type PinchFrameInput = {
  worldX: number;
  worldY: number;
  startScale: number;
  startDistance: number;
  midX: number;
  midY: number;
  currentDistance: number;
  rectLeft: number;
  rectTop: number;
  viewW: number;
  viewH: number;
  worldW: number;
  worldH: number;
};

export function pinchFrame(input: PinchFrameInput): {tileSize: number; cameraX: number; cameraY: number} {
  const tileSize = clampTileSize(
    input.startScale * input.currentDistance / input.startDistance,
    input.viewW,
    input.viewH,
    input.worldW,
    input.worldH,
  );
  const cameraX = input.worldX * tileSize - (input.midX - input.rectLeft);
  const cameraY = input.worldY * tileSize - (input.midY - input.rectTop);
  return {tileSize, cameraX, cameraY};
}

export function panCamera(startCamX: number, startCamY: number, dx: number, dy: number): Point {
  return {x: startCamX - dx, y: startCamY - dy};
}

export function exceedsPanThreshold(dx: number, dy: number, threshold = 6): boolean {
  return Math.abs(dx) + Math.abs(dy) > threshold;
}

export function shouldEmitTap(options: {
  cancelled: boolean;
  moved: boolean;
  suppressTap: boolean;
  endingPinch: boolean;
}): boolean {
  if (options.endingPinch || options.suppressTap) return false;
  return !options.cancelled && !options.moved;
}

export function shouldBeginPinch(touchCount: number): boolean {
  return touchCount === 2;
}

export function shouldSuppressMultiTouch(touchCount: number): boolean {
  return touchCount > 2;
}

/** Midpoint + distance for two touches in client space. */
export function pinchGestureSample(a: Point, b: Point): Point & {distance: number} {
  const mid = pointerPairMidpoint(a, b);
  const distance = pointerPairDistance(a, b);
  return {x: mid.x, y: mid.y, distance};
}

/** Client coords of pinch anchor given current camera (inverse of pinchWorldAnchor). */
export function anchoredClientPoint(
  worldX: number,
  worldY: number,
  tileSize: number,
  rectLeft: number,
  rectTop: number,
  cameraX: number,
  cameraY: number,
): Point {
  return {
    x: worldX * tileSize + rectLeft - cameraX,
    y: worldY * tileSize + rectTop - cameraY,
  };
}