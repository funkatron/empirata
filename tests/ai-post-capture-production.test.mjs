import test from 'node:test';
import assert from 'node:assert/strict';
import {
  adjudicateCityCapture,endTurn,exportSave,getPlayerView,importSave,
  makeRulesLab,playAiOpponent,requiredProductionTurns,updateAllKnowledge
} from '../dist/engine/index.js';

/** Small, faction-swapped capture with a surviving enemy home.
 * No campaign-wide combat rolls or map tuning are involved. */
function capturedFixture(attacker){
  const defender=attacker==='blue'?'red':'blue';
  const g=makeRulesLab();
  g.scenario='ai-vs-ai';
  g.active=attacker;
  const target=g.cities.find(c=>c.owner===defender);
  const secondHome=g.cities.find(c=>c.id==='c8');
  assert.ok(target&&secondHome);
  secondHome.owner=defender; // The opponent remains in the game after capture.
  const assault=g.units.find(u=>u.owner===attacker&&u.kind==='army');
  assert.ok(assault);
  g.units=g.units.filter(u=>u.owner===attacker);
  const from={x:target.position.x+(attacker==='blue'?-1:1),y:target.position.y};
  assert.equal(g.tiles[from.y*g.width+from.x],'land','Seeded army must start on land');
  assault.position=from;
  assault.spent=0;
  target.production='fighter';target.progress=4;target.firstCycle=false;
  updateAllKnowledge(g);
  assert.equal(g.knowledge[defender].cities[target.id].owner,defender);
  const captured=adjudicateCityCapture(g,{armyId:assault.id,cityId:target.id,outcome:'captured'});
  return {captured,attacker,defender,targetId:target.id,position:{...target.position}};
}

for(const attacker of ['blue','red']){
  test(`AI ${attacker} capture resets and restarts factory; production and intelligence survive save/reload`,()=>{
    const {captured,defender,targetId,position}=capturedFixture(attacker);
    const cityIn=state=>state.cities.find(c=>c.id===targetId);
    assert.equal(cityIn(captured).owner,attacker);
    assert.equal(cityIn(captured).production,null);
    assert.equal(cityIn(captured).progress,0);
    assert.equal(cityIn(captured).firstCycle,true);
    const priorIntel=captured.knowledge[defender].cities[targetId];
    assert.equal(priorIntel.owner,attacker,'Former owner knows it lost the city');
    assert.equal(priorIntel.productionKnown,false,'No captured factory intelligence leak');
    assert.equal(priorIntel.production,null);
    const snapshot=structuredClone(captured);

    // The real faction-neutral AI must commission the captured factory, not
    // merely a test manually selecting production on its behalf.
    let state=playAiOpponent(captured,attacker);
    assert.deepEqual(captured,snapshot,'The AI cannot mutate the input state');
    assert.equal(cityIn(state).production,'army');
    assert.equal(cityIn(state).progress,0);
    assert.equal(getPlayerView(state,attacker).ownCities.find(c=>c.id===targetId).production,'army');
    assert.equal(state.knowledge[defender].cities[targetId].productionKnown,false);
    assert.deepEqual(importSave(exportSave(state)),state,'Production assignment survives reload');

    const needed=requiredProductionTurns('army',true);
    assert.equal(needed,6,'The first-production fixture uses DOS ALG-006 timing');
    const initial=new Set(state.units.map(u=>u.id));
    for(let turn=1;turn<=needed;turn++){
      // Each full cycle visits the opponent and then returns to this AI's turn.
      state=endTurn(endTurn(state));
      assert.equal(state.active,attacker);
      if(turn===3)state=importSave(exportSave(state));
      const city=cityIn(state);
      assert.equal(city.production,'army');
      assert.equal(city.progress,turn===needed?0:turn,`Captured city progress after ${turn} turns`);
      assert.equal(city.firstCycle,turn!==needed);
      if(turn<needed)assert.equal(state.units.some(u=>!initial.has(u.id)&&u.owner===attacker&&
        u.position.x===position.x&&u.position.y===position.y),false,'No early completion');
    }
    assert.ok(state.units.some(u=>!initial.has(u.id)&&u.owner===attacker&&u.kind==='army'&&
      u.position.x===position.x&&u.position.y===position.y),'First unit completes in captured city');
    assert.equal(state.knowledge[defender].cities[targetId].productionKnown,false);
    assert.equal(state.knowledge[defender].cities[targetId].production,null);
    assert.deepEqual(importSave(exportSave(state)),state);
  });
}
