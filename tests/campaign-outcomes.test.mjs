import {test} from 'node:test';
import assert from 'node:assert/strict';
import {roundOutcomes} from '../scripts/campaign-outcomes.mjs';

test('campaign outcomes distinguish landed survivors from cargo lost with a hull',()=>{
  const before={units:[
    {id:'ship',owner:'blue',kind:'transport'},
    {id:'lost',owner:'blue',kind:'army',aboard:'ship'},
    {id:'landed',owner:'blue',kind:'army',aboard:'ship'},
    {id:'enemy',owner:'red',kind:'transport'},
  ],cities:[{id:'a',owner:null},{id:'b',owner:'blue'}]};
  const after={units:[{id:'landed',owner:'blue',kind:'army',aboard:null}],cities:[{id:'a',owner:'blue'},{id:'b',owner:'red'}]};
  assert.deepEqual(roundOutcomes(before,after,'blue'),{captures:1,citiesLost:1,transportsLost:1,loadedTransportsLost:1,embarkedUnitsLost:1});
  assert.equal(roundOutcomes(before,after,'red').loadedTransportsLost,0);
});

test('boarding and unloading do not count as transport losses',()=>{
  const before={units:[{id:'t',owner:'blue',kind:'transport'},{id:'a',owner:'blue',kind:'army',aboard:'t'}],cities:[]};
  const after={units:[{...before.units[0]},{...before.units[1],aboard:null}],cities:[]};
  assert.deepEqual(roundOutcomes(before,after,'blue'),{captures:0,citiesLost:0,transportsLost:0,loadedTransportsLost:0,embarkedUnitsLost:0});
});
