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

test('AI spectator controls support automatic viewpoint alternation and dual scorecards',()=>{
  assert.match(html,/id="spectatorSide"/);
  assert.match(html,/<option value="alternate">Alternate each round<\/option>/);
  assert.match(html,/id="spectatorNow"/);
  assert.match(html,/id="spectatorBlue"/);
  assert.match(html,/id="spectatorRed"/);
  assert.match(html,/id="autoPlay"/);
  assert.match(html,/id="advanceRounds"/);
  assert.match(html,/id="roundSpeed"/);
  for(const speed of [1,10,50,100])assert.match(html,new RegExp(`<option value="${speed}">${speed} rounds?<\\/option>`));
  assert.match(html,/id="roundProgress"[^>]*role="status"[^>]*hidden/);
  assert.match(html,/spectatorMode\s*===\s*['"]alternate['"]/);
  assert.match(html,/spectatorBlue/);
  assert.match(html,/spectatorRed/);
});

test('Touch map supports pinch gestures without dispatching accidental taps',()=>{
  assert.match(html,/function beginPinch\(/);
  assert.match(html,/pinch\.scale\s*\*\s*p\.distance\s*\/\s*pinch\.distance/);
  assert.match(html,/pinch\.worldX\s*\*\s*tileSize/);
  assert.match(html,/pinch\.worldY\s*\*\s*tileSize/);
  assert.match(html,/if\s*\(pinch\s*\|\|\s*suppressTap\)/);
  assert.match(html,/id="fitWorld"/);
});
