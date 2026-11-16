import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';

/** Minimal default-CI smoke: page exposes Priority 1 shell ids (no browser). Uses bundled `index.html` when present (post `build-single-file`), else `public/index.html`. */
const bundled=new URL('../index.html',import.meta.url);
const source=existsSync(bundled)?bundled:new URL('../public/index.html',import.meta.url);
const html=readFileSync(source,'utf8');

test('Standalone index exposes Game menu, map canvas, and map-local viewport toolbar',()=>{
  for(const id of ['gameMenu','map','fitWorld','zoomIn','zoomOut','recenter'])
    assert.match(html,new RegExp(`id="${id}"`));
  assert.match(html,/aria-label="Fit entire world"/);
  assert.ok(!html.includes('id="startSkirmish"'),'scenario start stays out of map toolbar');
});