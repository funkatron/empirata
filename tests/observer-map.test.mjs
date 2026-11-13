import test from 'node:test';
import assert from 'node:assert/strict';
import {getPlayerView,makeAiVsAiLab,makeRulesLab} from '../dist/engine/index.js';
import {
  observerTerrain,observerFogOpacity,SPECTATOR_FOG_OPACITY,EXPLORED_FOG_OPACITY,
  terrainLayerCacheKey,refreshShouldInvalidateKnowledgeLayer,
} from '../dist/ui/observer-map.js';

test('CvC spectator sees undiscovered geography through exactly 75% fog',()=>{
  const game=makeAiVsAiLab(),view=getPlayerView(game,'blue');
  const beforeGame=structuredClone(game),beforeView=structuredClone(view);
  const undiscovered=game.tiles.findIndex((t,i)=>t==='land'&&view.cells[i].terrain===null);
  assert.ok(undiscovered>=0,'Fixture must contain hidden land');
  assert.equal(observerTerrain(game,view,undiscovered,false),null);
  assert.equal(observerTerrain(game,view,undiscovered,true),'land');
  assert.equal(observerFogOpacity(game,view,undiscovered,false),0);
  assert.equal(observerFogOpacity(game,view,undiscovered,true),SPECTATOR_FOG_OPACITY);
  assert.equal(SPECTATOR_FOG_OPACITY,0.75);
  assert.ok(SPECTATOR_FOG_OPACITY>EXPLORED_FOG_OPACITY,'Unexplored territory should be visibly darker');
  assert.deepEqual(game,beforeGame,'Presentation must not mutate gameplay state');
  assert.deepEqual(view,beforeView,'Presentation must not mutate private intelligence');
});

test('Visible territory remains clear; explored territory still has fog',()=>{
  const game=makeAiVsAiLab(),view=getPlayerView(game,'red');
  const home=game.cities.find(c=>c.owner==='red');
  assert.ok(home);
  const index=home.position.y*game.width+home.position.x;
  assert.equal(view.cells[index].visible,true);
  assert.equal(observerFogOpacity(game,view,index,true),0);
  assert.equal(observerTerrain(game,view,index,true),'land');
  const remembered=structuredClone(view);
  remembered.cells[index].visible=false;
  assert.equal(observerFogOpacity(game,remembered,index,true),0.52);
  assert.equal(observerFogOpacity(game,remembered,index,false),0.52);
  assert.equal(EXPLORED_FOG_OPACITY,0.52);
});

test('Revealed spectator geography does not disclose undiscovered city ownership',()=>{
  const game=makeAiVsAiLab(),blue=getPlayerView(game,'blue');
  const redCity=game.cities.find(c=>c.owner==='red');
  assert.ok(redCity);
  const index=redCity.position.y*game.width+redCity.position.x;
  assert.equal(blue.cells[index].city,null,'The faction has not discovered the rival city');
  assert.equal(blue.cells[index].terrain,null);
  assert.equal(observerTerrain(game,blue,index,true),game.tiles[index]);
  assert.equal(observerFogOpacity(game,blue,index,true),0.75,'Unknown cities remain in full unexplored fog');
  assert.equal(blue.cells[index].city,null,'The spectator overlay does not change city intelligence');
  assert.equal(blue.enemies.length,0,'Enemy units do not become visible to the AI');
});

test('User-versus-computer never reveals hidden geography',()=>{
  const game=makeRulesLab(),view=getPlayerView(game,'blue');
  const unseen=game.tiles.findIndex((t,i)=>t==='land'&&view.cells[i].terrain===null);
  assert.ok(unseen>=0);
  assert.equal(observerTerrain(game,view,unseen,true),null);
  assert.equal(observerFogOpacity(game,view,unseen,true),0);
});

test('Reveal-on geography cache key ignores knowledge generation and visibility churn',()=>{
  const a=terrainLayerCacheKey(3,24,true,0);
  const b=terrainLayerCacheKey(3,24,true,99);
  assert.equal(a,b,'Visibility-only refreshes must keep the stamped geography layer');
  assert.equal(a,'geo|3|24');
  assert.notEqual(terrainLayerCacheKey(3,24,true,0),terrainLayerCacheKey(4,24,true,0));
  assert.notEqual(terrainLayerCacheKey(3,24,true,0),terrainLayerCacheKey(3,30,true,0));
});

test('Knowledge terrain cache key tracks exploration generation',()=>{
  assert.equal(terrainLayerCacheKey(1,16,false,7),'know|1|16|7');
  assert.notEqual(terrainLayerCacheKey(1,16,false,7),terrainLayerCacheKey(1,16,false,8));
});

test('Only CvC reveal-on skips knowledge-layer invalidation on refresh',()=>{
  assert.equal(refreshShouldInvalidateKnowledgeLayer('ai-vs-ai',true),false);
  assert.equal(refreshShouldInvalidateKnowledgeLayer('ai-vs-ai',false),true);
  assert.equal(refreshShouldInvalidateKnowledgeLayer('close-quarters',true),true);
  assert.equal(refreshShouldInvalidateKnowledgeLayer('ai-invasion',false),true);
});
