import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';

/** Minimal default-CI smoke: page exposes Priority 1 shell ids (no browser). Prefer `dist/index.html` (post `npm run build`), then standalone `index.html`, then `public/index.html`. */
const distHtml=new URL('../dist/index.html',import.meta.url);
const bundled=new URL('../index.html',import.meta.url);
const publicHtml=new URL('../public/index.html',import.meta.url);
const source=existsSync(distHtml)?distHtml:existsSync(bundled)?bundled:publicHtml;
const html=readFileSync(source,'utf8');

test('Standalone index exposes Game menu, map canvas, and map-local viewport toolbar',()=>{
  for(const id of ['gameMenu','gameMenuDialog','map','fitWorld','zoomIn','zoomOut','recenter'])
    assert.match(html,new RegExp(`id="${id}"`));
  assert.match(html,/aria-label="Fit entire world"/);
  assert.ok(!html.includes('id="startSkirmish"'),'scenario start stays out of map toolbar');
});