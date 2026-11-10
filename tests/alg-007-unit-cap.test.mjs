import test from 'node:test';
import assert from 'node:assert/strict';
import {makeRulesLab,endTurn,DOS_UNIT_SLOT_LIMIT} from '../dist/engine/game.js';

function saturatedGame(count) {
  const game=makeRulesLab();
  const template=structuredClone(game.units[0]);
  while(game.units.length<count){
    const id='slot-'+game.units.length;
    game.units.push({...template,id,owner:'blue',position:{x:8,y:25},aboard:null,spent:1});
  }
  const city=game.cities.find(c=>c.id==='c-red');
  city.production='army';city.firstCycle=false;city.progress=4;
  return game;
}
test('ALG-007 1000 live and embarked units halt production without consuming a slot',()=>{
  const game=saturatedGame(DOS_UNIT_SLOT_LIMIT);
  const next=endTurn(game);
  assert.equal(next.units.length,DOS_UNIT_SLOT_LIMIT);
  assert.equal(next.cities.find(c=>c.id==='c-red').progress,5);
  assert.ok(next.events.some(e=>e.message.includes('overpopulated')));
});
test('ALG-007 999 units permit the next production completion',()=>{
  const game=saturatedGame(DOS_UNIT_SLOT_LIMIT-1);
  const next=endTurn(game);
  assert.equal(next.units.length,DOS_UNIT_SLOT_LIMIT);
  assert.equal(next.cities.find(c=>c.id==='c-red').progress,0);
});
