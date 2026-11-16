import test from 'node:test';
import assert from 'node:assert/strict';
import {
  anchoredClientPoint,
  exceedsPanThreshold,
  panCamera,
  pinchFrame,
  pinchGestureSample,
  pinchWorldAnchor,
  pointerPairDistance,
  shouldEmitTap,
} from '../dist/ui/gestures.js';
import {clampTileSize} from '../dist/ui/camera.js';

const VIEW = {w: 834, h: 1194, worldW: 100, worldH: 60};
const RECT = {left: 12, top: 88};

test('spread pinch increases tile scale (zoom in)', () => {
  const startDist = 100;
  const spreadDist = 200;
  const startScale = 20;
  const a = pinchFrame({
    worldX: 10,
    worldY: 5,
    startScale,
    startDistance: startDist,
    midX: 400,
    midY: 300,
    currentDistance: spreadDist,
    rectLeft: RECT.left,
    rectTop: RECT.top,
    viewW: VIEW.w,
    viewH: VIEW.h,
    worldW: VIEW.worldW,
    worldH: VIEW.worldH,
  });
  const b = pinchFrame({
    worldX: 10,
    worldY: 5,
    startScale,
    startDistance: startDist,
    midX: 400,
    midY: 300,
    currentDistance: startDist,
    rectLeft: RECT.left,
    rectTop: RECT.top,
    viewW: VIEW.w,
    viewH: VIEW.h,
    worldW: VIEW.worldW,
    worldH: VIEW.worldH,
  });
  assert.ok(a.tileSize > b.tileSize, 'spreading fingers increases tileSize');
  assert.ok(Math.abs(a.tileSize / b.tileSize - 2) < 0.01, 'scale factor tracks distance ratio before extra clamp interaction');
});

test('pinch inward decreases tile scale (zoom out)', () => {
  const startDist = 200;
  const inwardDist = 100;
  const startScale = 30;
  const wide = pinchFrame({
    worldX: 1,
    worldY: 1,
    startScale,
    startDistance: startDist,
    midX: 300,
    midY: 400,
    currentDistance: startDist,
    rectLeft: 0,
    rectTop: 0,
    viewW: VIEW.w,
    viewH: VIEW.h,
    worldW: VIEW.worldW,
    worldH: VIEW.worldH,
  });
  const narrow = pinchFrame({
    worldX: 1,
    worldY: 1,
    startScale,
    startDistance: startDist,
    midX: 300,
    midY: 400,
    currentDistance: inwardDist,
    rectLeft: 0,
    rectTop: 0,
    viewW: VIEW.w,
    viewH: VIEW.h,
    worldW: VIEW.worldW,
    worldH: VIEW.worldH,
  });
  assert.ok(narrow.tileSize < wide.tileSize);
});

test('world anchor keeps client point under midpoint when scale changes', () => {
  const tileSize = 18;
  const mid = {x: 500, y: 400};
  const cam = {x: 120, y: 80};
  const anchor = pinchWorldAnchor(mid.x, mid.y, RECT.left, RECT.top, cam.x, cam.y, tileSize);
  const clientBefore = anchoredClientPoint(anchor.worldX, anchor.worldY, tileSize, RECT.left, RECT.top, cam.x, cam.y);
  assert.ok(Math.abs(clientBefore.x - mid.x) < 1e-6);
  const nextSize = 36;
  const framed = pinchFrame({
    worldX: anchor.worldX,
    worldY: anchor.worldY,
    startScale: tileSize,
    startDistance: 100,
    midX: mid.x,
    midY: mid.y,
    currentDistance: 200,
    rectLeft: RECT.left,
    rectTop: RECT.top,
    viewW: VIEW.w,
    viewH: VIEW.h,
    worldW: VIEW.worldW,
    worldH: VIEW.worldH,
  });
  const clientAfter = anchoredClientPoint(anchor.worldX, anchor.worldY, framed.tileSize, RECT.left, RECT.top, framed.cameraX, framed.cameraY);
  assert.ok(Math.abs(clientAfter.x - mid.x) < 1e-6);
  assert.ok(Math.abs(clientAfter.y - mid.y) < 1e-6);
});

test('midpoint move pans camera when pinch distance is constant', () => {
  const anchor = {worldX: 12, worldY: 8};
  const start = pinchFrame({
    ...anchor,
    startScale: 22,
    startDistance: 90,
    midX: 200,
    midY: 200,
    currentDistance: 90,
    rectLeft: 0,
    rectTop: 0,
    viewW: VIEW.w,
    viewH: VIEW.h,
    worldW: VIEW.worldW,
    worldH: VIEW.worldH,
  });
  const panned = pinchFrame({
    ...anchor,
    startScale: 22,
    startDistance: 90,
    midX: 240,
    midY: 220,
    currentDistance: 90,
    rectLeft: 0,
    rectTop: 0,
    viewW: VIEW.w,
    viewH: VIEW.h,
    worldW: VIEW.worldW,
    worldH: VIEW.worldH,
  });
  assert.equal(panned.tileSize, start.tileSize);
  assert.notEqual(panned.cameraX, start.cameraX);
  assert.notEqual(panned.cameraY, start.cameraY);
});

test('pan threshold separates tap from drag', () => {
  assert.equal(exceedsPanThreshold(3, 3), false);
  assert.equal(exceedsPanThreshold(4, 4), true);
});

test('shouldEmitTap rejects move, cancel, suppress, and pinch end', () => {
  assert.equal(shouldEmitTap({cancelled: false, moved: false, suppressTap: false, endingPinch: false}), true);
  assert.equal(shouldEmitTap({cancelled: false, moved: true, suppressTap: false, endingPinch: false}), false);
  assert.equal(shouldEmitTap({cancelled: true, moved: false, suppressTap: false, endingPinch: false}), false);
  assert.equal(shouldEmitTap({cancelled: false, moved: false, suppressTap: true, endingPinch: false}), false);
  assert.equal(shouldEmitTap({cancelled: false, moved: false, suppressTap: false, endingPinch: true}), false);
});

test('single-finger pan uses inverted drag delta', () => {
  const start = {x: 100, y: 200};
  const next = panCamera(start.x, start.y, 15, -10);
  assert.deepEqual(next, {x: 85, y: 210});
});

test('pinchFrame uses clampTileSize floor at extreme zoom out', () => {
  const raw = 2 * 0.01;
  const floored = pinchFrame({
    worldX: 1,
    worldY: 1,
    startScale: 2,
    startDistance: 100,
    midX: 100,
    midY: 100,
    currentDistance: 1,
    rectLeft: 0,
    rectTop: 0,
    viewW: VIEW.w,
    viewH: VIEW.h,
    worldW: VIEW.worldW,
    worldH: VIEW.worldH,
  });
  assert.equal(floored.tileSize, clampTileSize(raw, VIEW.w, VIEW.h, VIEW.worldW, VIEW.worldH));
});

test('pinchGestureSample matches legacy hypot distance', () => {
  const sample = pinchGestureSample({x: 0, y: 0}, {x: 30, y: 40});
  assert.equal(sample.x, 15);
  assert.equal(sample.y, 20);
  assert.equal(sample.distance, pointerPairDistance({x: 0, y: 0}, {x: 30, y: 40}));
});