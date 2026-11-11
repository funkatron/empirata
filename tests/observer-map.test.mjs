import test from 'node:test';
import assert from 'node:assert/strict';
import {getPlayerView,makeAiVsAiLab,makeRulesLab} from '../dist/engine/index.js';
import {observerTerrain,observerFogOpacity,SPECTATOR_FOG_OPACITY} from '../dist/ui/observer-map.js';

test('CvC spectator sees undiscovered geography through exactly 60% fog',()=>{
  const game=makeAiVsAiLab(),view=getPlayerView(game,'blue');
  const beforeGame=structuredClone(game),beforeView=structuredClone(view);
  const undiscovered=game.tiles.findIndex((t,i)=>t==='land'&&view.cells[i].terrain===null);
  assert.ok(undiscovered>=0,'Fixture must contain hidden land');
  assert.equal(observerTerrain(game,view,undiscovered,false),null);
  assert.equal(observerTerrain(game,view,undiscovered,true),'land');
  assert.equal(observerFogOpacity(game,view,undiscovered,false),0);
  assert.equal(observerFogOpacity(game,view,undiscovered,true),SPECTATOR_FOG_OPACITY);
  assert.equal(SPECTATOR_FOG_OPACITY,0.6);
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
  assert.equal(observerFogOpacity(game,remembered,index,true),0.6);
  assert.equal(observerFogOpacity(game,remembered,index,false),0.52);
});

test('Revealed spectator geography does not disclose undiscovered city ownership',()=>{
  const game=makeAiVsAiLab(),blue=getPlayerView(game,'blue');
  const redCity=game.cities.find(c=>c.owner==='red');
  assert.ok(redCity);
  const index=redCity.position.y*game.width+redCity.position.x;
  assert.equal(blue.cells[index].city,null,'The faction has not discovered the rival city');
  assert.equal(blue.cells[index].terrain,null);
  assert.equal(observerTerrain(game,blue,index,true),game.tiles[index]);
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
