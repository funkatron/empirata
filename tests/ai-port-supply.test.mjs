import test from 'node:test';
import assert from 'node:assert/strict';
import {makeRulesLab,playAiOpponent,updateAllKnowledge} from '../dist/engine/index.js';

for(const faction of ['blue','red']){
  test(`AI ${faction} replenishes an empty home-port transport without sacrificing the city guard`,()=>{
    const g=makeRulesLab();
    const city=g.cities.find(c=>c.owner===faction);
    const guard=g.units.find(u=>u.owner===faction&&u.kind==='army');
    assert.ok(city&&guard);
    guard.position={...city.position};
    g.units=g.units.filter(u=>u.owner!==faction||u.id===guard.id);
    const ship={...structuredClone(guard),id:`${faction}-waiting-transport`,kind:'transport',
      fuel:null,aboard:null,spent:0,damage:0,order:{kind:'none'}};
    g.units.push(ship);
    city.production='destroyer';city.progress=0;city.firstCycle=false;
    g.active=faction;
    updateAllKnowledge(g);

    const supplying=playAiOpponent(g,faction);
    assert.equal(supplying.cities.find(c=>c.id===city.id).production,'army',
      'A transport with no available army must outrank optional naval production');
    assert.equal(supplying.units.find(u=>u.id===guard.id).aboard,null,
      'The city garrison must not be used as cargo');

    // A replacement army becomes eligible to embark on the next AI action.
    const replacement={...structuredClone(guard),id:`${faction}-replacement`,spent:0};
    supplying.units.push(replacement);
    updateAllKnowledge(supplying);
    const boarded=playAiOpponent(supplying,faction);
    assert.equal(boarded.units.find(u=>u.id===replacement.id).aboard,ship.id);
    assert.equal(boarded.units.find(u=>u.id===guard.id).aboard,null);
  });
}
