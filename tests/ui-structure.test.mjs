import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');

test('Semantic UI: global Game menu and map-local viewport controls',()=>{
  assert.match(html,/id="gameMenu"/);
  assert.match(html,/id="startCampaign"/);
  assert.match(html,/id="fitWorld"/);
  assert.ok(!html.includes('id="startSkirmish"'),'scenario start must not live in map toolbar');
});

test('City stack selector dialog is present for U1 inspection flows',()=>{
  assert.match(html,/id="stackDialog"/);
  assert.match(html,/id="stackChoices"/);
  assert.match(html,/id="stackTitle"/);
  assert.match(html,/Choose a unit or the city to inspect/);
});

test('CvC observer has a checked-by-default full-map fog toggle',()=>{
  assert.match(html,/<input type="checkbox" id="spectatorTerrain" checked\/>/);
  assert.match(html,/Show entire map beneath fog \(60%\)/);
  assert.match(html,/Undiscovered city locations appear without ownership/);
});
