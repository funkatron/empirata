import test from 'node:test';
import assert from 'node:assert/strict';
import {canDetect,updateAllKnowledge} from '../dist/engine/knowledge.js';
import {makeRulesLab} from '../dist/engine/game.js';

test('ALG-012 recovered matrix: submarines detect submarines but not armies or fighters',()=>{
  assert.equal(canDetect('submarine','submarine'),true);
  assert.equal(canDetect('submarine','army'),false);
  assert.equal(canDetect('submarine','fighter'),false);
  assert.equal(canDetect('submarine','destroyer'),true);
});
test('ALG-012 destroyer and cruiser detect submarines; city observers detect all',()=>{
  for(const kind of ['destroyer','cruiser','city'])assert.equal(canDetect(kind,'submarine'),true);
  for(const kind of ['army','fighter','transport','carrier','battleship'])
    assert.equal(canDetect(kind,'submarine'),false);
});
test('ALG-012 adjacent submarine sightings are shared without revealing undetectable armies',()=>{
  const g=makeRulesLab();
  g.units=[{
    id:'observer',owner:'blue',kind:'submarine',position:{x:20,y:20},
    damage:0,spent:0,fuel:null,order:{kind:'none'},aboard:null
  },{
    id:'enemy-sub',owner:'red',kind:'submarine',position:{x:21,y:20},
    damage:0,spent:0,fuel:null,order:{kind:'none'},aboard:null
  },{
    id:'enemy-army',owner:'red',kind:'army',position:{x:20,y:21},
    damage:0,spent:0,fuel:null,order:{kind:'none'},aboard:null
  }];
  updateAllKnowledge(g);
  assert.ok(g.knowledge.blue.freshEnemies.includes('enemy-sub'));
  assert.ok(!g.knowledge.blue.freshEnemies.includes('enemy-army'));
});
