import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('Standalone browser build contains the map, styles and controls',()=>{
  assert.match(html,/<canvas id="map"/);
  assert.match(html,/<style>/);
  assert.doesNotMatch(html,/src="\.\/ui\/main\.js"/);
  assert.doesNotMatch(html,/href="\.\/styles\.css"/);
  assert.match(html,/loadShipButton/);
  assert.match(html,/unloadShipButton/);
});
test('Bundled application JavaScript is syntactically valid and self-contained',()=>{
  const match=html.match(/<script>\s*([\s\S]*?)<\/script>/);
  assert.ok(match,'Expected embedded bundle script');
  assert.doesNotThrow(()=>new Script(match[1],{filename:'empirata-standalone.js'}));
  assert.match(match[1],/__modules\["engine\/game\.js"\]/);
  assert.match(match[1],/__modules\["ui\/main\.js"\]/);
  assert.match(match[1],/__load\('ui\/main\.js'\)/);
});
