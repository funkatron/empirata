import test from 'node:test';
import assert from 'node:assert/strict';
import {makeRulesLab,getPlayerView,dosOwnUnitInventory} from '../dist/engine/index.js';

test('ALG-AI-002: inventory counts only the acting faction own units',()=>{
  const game=makeRulesLab();
  const blue=getPlayerView(game,'blue');
  const counts=dosOwnUnitInventory(blue);
  assert.equal(counts.army,1);
  assert.equal(counts.destroyer,1);
  assert.equal(counts.transport,0);
  assert.equal(counts.battleship,0);
  assert.equal(Object.values(counts).reduce((a,b)=>a+b,0),blue.ownUnits.length);
});

test('ALG-AI-002: embarked units still count in inventory',()=>{
  const game=makeRulesLab();
  const blue=getPlayerView(game,'blue');
  const army=blue.ownUnits.find(u=>u.kind==='army');
  assert.ok(army);
  army.aboard='some-ship';
  assert.equal(dosOwnUnitInventory(blue).army,1);
});

test('ALG-AI-002: inventory is independent of enemy unit additions',()=>{
  const game=makeRulesLab();
  const blue=getPlayerView(game,'blue');
  const before=dosOwnUnitInventory(blue);
  game.units.push({...game.units.find(u=>u.owner==='red'),id:'extra-red'});
  assert.deepEqual(dosOwnUnitInventory(getPlayerView(game,'blue')),before);
});
