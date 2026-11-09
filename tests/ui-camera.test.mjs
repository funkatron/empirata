import test from 'node:test';
import assert from 'node:assert/strict';
import {clampTileSize,fitTileSize,maxTileSize} from '../dist/ui/camera.js';

test('fitTileSize shows entire 100×60 world in representative viewports',()=>{
  assert.ok(fitTileSize(1024,768,100,60)<=768/60);
  const portrait=fitTileSize(834,1194,100,60);
  assert.ok(portrait*60<=1194);
  assert.ok(portrait*100<=834);
});

test('maxTileSize grows on large viewports instead of hard-capping at 45',()=>{
  assert.equal(maxTileSize(52,52),45);
  assert.ok(maxTileSize(1024,768)>45);
  assert.ok(maxTileSize(1194,834)>maxTileSize(1024,768));
});

test('clampTileSize never goes below fit or above max',()=>{
  const w=1024,h=768,ww=100,wh=60;
  const fit=fitTileSize(w,h,ww,wh);
  const max=maxTileSize(w,h);
  assert.equal(clampTileSize(1,w,h,ww,wh),fit);
  assert.equal(clampTileSize(1000,w,h,ww,wh),max);
  const mid=(fit+max)/2;
  assert.equal(clampTileSize(mid,w,h,ww,wh),mid);
});
