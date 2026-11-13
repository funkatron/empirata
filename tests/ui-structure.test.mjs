import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');

test('Semantic UI: global Game menu and map-local viewport controls',()=>{
  assert.match(html,/id="gameMenu"/);
  assert.match(html,/id="startCampaign"/);
  assert.match(html,/id="campaignAlgorithm"/);
  assert.match(html,/id="campaignDensity"/);
  assert.match(html,/id="campaignLayout"/);
  assert.match(html,/id="campaignSeedSource"/);
  assert.match(html,/id="campaignSeed"/);
  assert.match(html,/value="random"/);
  assert.match(html,/id="testScenariosMenu"/);
  assert.match(html,/class="studyMapButton"/);
  assert.match(html,/data-layout="continents" data-seed="83"/);
  assert.match(html,/id="copyMapSeed"/);
  assert.match(html,/id="exportMapRecipe"/);
  assert.match(html,/id="importMapRecipe"/);
  assert.match(html,/organic-v1/);
  assert.match(html,/id="fitWorld"/);
  assert.ok(!html.includes('id="startSkirmish"'),'scenario start must not live in map toolbar');
  assert.ok(!html.includes('id="campaignMap"'),'legacy combined layout:seed select was replaced');
  assert.ok(!html.includes('id="campaignPreset"'),'study presets live under Test scenarios');
});

test('City stack selector dialog is present for U1 inspection flows',()=>{
  assert.match(html,/id="stackDialog"/);
  assert.match(html,/id="stackChoices"/);
  assert.match(html,/id="stackTitle"/);
  assert.match(html,/Choose a unit or the city to inspect/);
});

test('CvC observer has a checked-by-default full-map fog toggle',()=>{
  assert.match(html,/<input type="checkbox" id="spectatorTerrain" checked\/>/);
  assert.match(html,/Show entire map beneath fog \(75%\)/);
  assert.match(html,/Unexplored terrain has 75% fog; explored but unseen terrain has 52%/);
});
