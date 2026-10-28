import test from 'node:test';import assert from 'node:assert/strict';
import {makeAiInvasionLab,endTurn,getPlayerView,updateAiTransportMission,planAiLandingSquares,exportSave,importSave} from '../dist/engine/index.js';
function fixture(){const g=endTurn(makeAiInvasionLab()),ship=g.units.find(u=>u.id==='red-transport'),view=getPlayerView(g,'red');return {g,ship,view};}
test('A stagnant mission expires at the boundary, then becomes eligible after cooldown',()=>{
 const {ship,view}=fixture();let planned=updateAiTransportMission(view,ship);const initial=structuredClone(planned);
 view.round=24;planned=updateAiTransportMission(view,planned);assert.equal(planned.aiObjective,'invasion-outpost');
 view.round=25;planned=updateAiTransportMission(view,planned);assert.equal(planned.aiObjective,undefined);assert.equal(planned.aiAvoidObjective.id,'invasion-outpost');
 assert.deepEqual(planAiLandingSquares(view,planned),[]);
 view.round=36;assert.equal(updateAiTransportMission(view,planned).aiObjective,undefined);
 view.round=37;assert.equal(updateAiTransportMission(view,planned).aiObjective,'invasion-outpost');
 assert.equal(initial.aiMissionProgress.round,1,'Input is not mutated');
});
test('Closer approach and unloading restart the no-progress timer',()=>{
 const {ship,view}=fixture();view.ownUnits.push({...view.ownUnits.find(u=>u.aboard===ship.id),id:'second-cargo'});let planned=updateAiTransportMission(view,ship);
 view.round=24;planned.position={x:80,y:30};planned=updateAiTransportMission(view,planned);assert.equal(planned.aiMissionProgress.round,24);
 view.round=47;view.ownUnits=view.ownUnits.filter(u=>u.id!=='second-cargo');
 planned=updateAiTransportMission(view,planned);assert.equal(planned.aiMissionProgress.round,47);
 assert.equal(planned.aiObjective,'invasion-outpost');
});
test('A stalled objective yields to another discovered city, with retry state surviving reload',()=>{
 const {g,ship,view}=fixture();let planned=updateAiTransportMission(view,ship);
 const city=g.cities.find(c=>c.id==='c-blue');view.cells[city.position.y*view.width+city.position.x]={terrain:'land',visible:false,city:{id:city.id,owner:'blue'}};
 view.round=25;planned=updateAiTransportMission(view,planned);assert.equal(planned.aiObjective,'c-blue');
 g.round=25;Object.assign(g.units.find(u=>u.id===ship.id),planned);assert.deepEqual(importSave(exportSave(g)).units,g.units);
 const invalid=structuredClone(g);invalid.units.find(u=>u.id===ship.id).aiMissionProgress.round=26;
 assert.throws(()=>importSave(exportSave(invalid)),/progress/);
});
