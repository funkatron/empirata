import test from 'node:test';
import assert from 'node:assert/strict';
import {
  adjudicateCityCapture,makeRulesLab,endTurn,exportSave,getPlayerView,importSave,
  selectProduction,updateAllKnowledge
} from '../dist/engine/index.js';

test('P0: all factions lose stale pre-capture ownership on city knowledge',()=>{
  const g=makeRulesLab();
  const target=g.cities.find(c=>c.owner==='red');
  assert.ok(target);
  target.production='fighter';target.progress=2;
  for(const faction of ['blue','red','green']){
  g.knowledge[faction].cities[target.id]={id:target.id,owner:'red',
      production:faction==='red'?'fighter':null,productionKnown:faction==='red'};
  }
  updateAllKnowledge(g);
  const army=g.units.find(u=>u.owner==='blue'&&u.kind==='army');
  army.position={x:target.position.x+1,y:target.position.y};army.spent=0;g.active='blue';
  const captured=adjudicateCityCapture(g,{armyId:army.id,cityId:target.id,outcome:'captured'});
  for(const faction of ['blue','red','green']){
    const intel=captured.knowledge[faction].cities[target.id];
    assert.equal(intel.owner,'blue',`${faction} must not retain red ownership`);
    if(faction!=='blue'){
      assert.equal(intel.production,null);
      assert.equal(intel.productionKnown,false,`${faction} must not learn captured-factory details`);
    }
  }
  const redCell=getPlayerView(captured,'red').cells[target.position.y*captured.width+target.position.x];
  assert.equal(redCell.city?.owner,'blue');
  assert.equal(redCell.city?.productionKnown,false);
  const reloaded=importSave(exportSave(captured));
  assert.deepEqual(reloaded.knowledge.green.cities[target.id],captured.knowledge.green.cities[target.id]);
});

test('P0: explored off-sight lost port does not leak conquered production to former owner',()=>{
  const g=makeRulesLab();
  const port=g.cities.find(c=>c.owner==='red');
  assert.ok(port);
  port.production='destroyer';port.progress=4;port.firstCycle=false;
  updateAllKnowledge(g);
  assert.equal(g.knowledge.red.cities[port.id].owner,'red');
  const army=g.units.find(u=>u.owner==='blue'&&u.kind==='army');
  g.active='blue';
  army.position={x:port.position.x+1,y:port.position.y};army.spent=0;
  const captured=adjudicateCityCapture(g,{armyId:army.id,cityId:port.id,outcome:'captured'});
  captured.cities.find(c=>c.id===port.id).production='transport';
  updateAllKnowledge(captured);
  const redView=getPlayerView(captured,'red');
  const cell=redView.cells[port.position.y*captured.width+port.position.x];
  assert.equal(cell.city?.owner,'blue');
  assert.equal(cell.city?.production,null);
  assert.equal(cell.city?.productionKnown,false);
});

test('P0: human-side capture does not auto-assign production; explicit pick then completes',()=>{
  const initial=makeRulesLab();
  const target=initial.cities.find(c=>c.owner==='red');
  const army=initial.units.find(u=>u.owner==='blue'&&u.kind==='army');
  army.position={x:target.position.x+1,y:target.position.y};army.spent=0;initial.active='blue';
  const captured=adjudicateCityCapture(initial,{armyId:army.id,cityId:target.id,outcome:'captured'});
  assert.equal(captured.cities.find(c=>c.id===target.id).production,null);
  let g=selectProduction(captured,target.id,'army');
  const pos={...target.position};
  const before=g.units.filter(u=>u.owner==='blue'&&u.position.x===pos.x&&u.position.y===pos.y).length;
  for(let i=0;i<40;i++){
    g=endTurn(g);
    if(g.units.filter(u=>u.owner==='blue'&&u.position.x===pos.x&&u.position.y===pos.y).length>before)break;
  }
  assert.ok(g.units.some(u=>u.owner==='blue'&&u.kind==='army'&&u.position.x===pos.x&&u.position.y===pos.y));
});