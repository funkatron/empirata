import test from 'node:test';import assert from 'node:assert/strict';
import {makeRulesLab,endTurn,playRedOpponent,updateAllKnowledge,emptyKnowledge,getPlayerView,planAiTransportAssembly,exportSave,importSave} from '../dist/engine/index.js';
function force(){
 const g=endTurn(makeRulesLab()),base=g.units.find(u=>u.owner==='red');g.tiles.fill('sea');g.units=[];
 g.cities=[{id:'target',position:{x:50,y:30},owner:'blue',production:null,progress:0,firstCycle:true}];
 for(let x=49;x<=52;x++)for(let y=29;y<=31;y++)g.tiles[y*g.width+x]='land';
 for(const [id,x] of [['lead',44],['rear',34]]){
  const ship={...structuredClone(base),id,kind:'transport',position:{x,y:30},aiObjective:'target'};g.units.push(ship);
  for(let i=0;i<3;i++)g.units.push({...structuredClone(base),id:`${id}-${i}`,aboard:id,position:{...ship.position}});
 }
 for(const f of ['blue','red','green'])g.knowledge[f]=emptyKnowledge(g);
 g.knowledge.red.terrain=[...g.tiles];g.knowledge.red.cities.target={id:'target',owner:'blue',production:null,productionKnown:false};
 updateAllKnowledge(g);return g;
}
test('Leading hostile transport waits while rear ship closes, then resumes with replay',()=>{
 let g=force();const first=playRedOpponent(g);
 assert.deepEqual(first.units.find(u=>u.id==='lead').position,{x:44,y:30});
 assert.ok(first.units.find(u=>u.id==='rear').position.x>34);
 assert.deepEqual(playRedOpponent(importSave(exportSave(g))),first);
 g=first;for(let i=0;i<6;i++)g=playRedOpponent(endTurn(endTurn(g)));
 assert.ok(g.units.find(u=>u.id==='lead').position.x>44);
});
test('Rendezvous releases at its deadline and does not restart the same wait',()=>{
 const g=force(),view=getPlayerView(g,'red'),ship=view.ownUnits.find(u=>u.id==='lead');
 const plan=planAiTransportAssembly(view,ship);assert.equal(plan.wait,true);
 view.round+=12;assert.equal(planAiTransportAssembly(view,plan.ship).wait,false);
 view.round++;assert.equal(planAiTransportAssembly(view,plan.ship).wait,false);
});
test('Neutral missions, lone transports and unsafe stations do not wait for invasion partners',()=>{
 const g=force(),view=getPlayerView(g,'red'),ship=view.ownUnits.find(u=>u.id==='lead');
 const lone=structuredClone(view);lone.ownUnits=lone.ownUnits.filter(u=>u.id!=='rear'&&u.aboard!=='rear');
 assert.equal(planAiTransportAssembly(lone,ship).wait,false);
 view.cells[30*view.width+50].city.owner=null;assert.equal(planAiTransportAssembly(view,ship).wait,false);
 view.cells[30*view.width+50].city.owner='blue';view.enemies.push({id:'danger',kind:'army',owner:'blue',position:{x:45,y:30},stale:false});
 assert.equal(planAiTransportAssembly(view,ship).wait,false);
});
test('Assembly state validates save rounds and clears after objective invalidation',()=>{
 const g=force();g.units[0].aiAssembly={objective:'target',startedRound:g.round};assert.deepEqual(importSave(exportSave(g)),g);
 g.units[0].aiAssembly.startedRound=g.round+1;assert.throws(()=>importSave(exportSave(g)),/assembly/);
 g.cities[0].owner='red';updateAllKnowledge(g);
 assert.equal(planAiTransportAssembly(getPlayerView(g,'red'),g.units[0]).ship.aiAssembly,undefined);
});
test('Underfilled invasion transport recruits only beside an army-producing supply city',()=>{
 const g=force(),view=getPlayerView(g,'red'),ship=view.ownUnits.find(u=>u.id==='lead');
 view.ownUnits.find(u=>u.id==='rear').position={x:43,y:30};
 view.ownCities.push({id:'supply',position:{x:44,y:30},owner:'red',production:'army',progress:0,firstCycle:false});
 assert.equal(planAiTransportAssembly(view,ship).wait,true);
 view.ownCities[0].production='fighter';assert.equal(planAiTransportAssembly(view,ship).wait,false);
});
test('Broad beach waits for the full available two-transport wave to become ready',async()=>{
 const {planAiLandingWave}=await import('../dist/engine/index.js');
 const width=16,height=12,view={width,height,active:'red',round:1,ownCities:[],ownUnits:[],enemies:[],events:[],cells:Array.from({length:width*height},()=>({terrain:'sea',visible:true,city:null}))};
 for(let y=4;y<=6;y++)for(let x=4;x<=9;x++)view.cells[y*width+x].terrain='land';
 view.cells[4*width+7]={terrain:'land',visible:true,city:{id:'target',owner:'blue'}};
 for(const [id,x] of [['one',6],['two',8]]){
  view.cells[5*width+x].terrain='sea';
  const ship={id,owner:'red',kind:'transport',position:{x,y:5},aboard:null,spent:0,damage:0,fuel:null,order:{kind:'none'},aiObjective:'target'};view.ownUnits.push(ship);
  for(let i=0;i<6;i++)view.ownUnits.push({...structuredClone(ship),id:`${id}-${i}`,kind:'army',aboard:id});
 }
 assert.equal(planAiLandingWave(view).length,12);
 view.ownUnits.find(u=>u.id==='two-0').spent=1;
 assert.deepEqual(planAiLandingWave(view),[]);
});
function recruiting(){
 const g=force(),v=getPlayerView(g,'red'),lead=v.ownUnits.find(u=>u.id==='lead'),rear=v.ownUnits.find(u=>u.id==='rear');
 rear.position={x:43,y:30};delete rear.aiObjective;v.ownUnits=v.ownUnits.filter(u=>u.aboard!=='rear');
 v.ownCities.push({id:'supply',position:{x:43,y:30},owner:'red',production:'army',progress:0,firstCycle:false});
 v.cells[30*v.width+43]={terrain:'land',visible:true,city:{id:'supply',owner:'red'}};
 return {v,lead,rear};
}
test('Hostile recruitment waits for an empty nearby supply partner before its first load',()=>{
 const {v,lead}=recruiting(),before=structuredClone(v),plan=planAiTransportAssembly(v,lead);
 assert.equal(plan.wait,true);assert.deepEqual(v,before);
 v.round+=12;assert.equal(planAiTransportAssembly(v,plan.ship).wait,false);
});
test('A full lead ship waits for a nearby partner to finish loading, then both can depart',()=>{
 const {v,lead,rear}=recruiting();
 for(let i=3;i<6;i++)v.ownUnits.push({...structuredClone(v.ownUnits.find(u=>u.aboard==='lead')),id:`extra-${i}`});
 assert.equal(planAiTransportAssembly(v,lead).wait,true);
 rear.aiObjective='target';for(let i=0;i<6;i++)v.ownUnits.push({...structuredClone(v.ownUnits.find(u=>u.aboard==='lead')),id:`rear-load-${i}`,aboard:rear.id,position:{...rear.position}});
 assert.equal(planAiTransportAssembly(v,lead).wait,false);
 assert.equal(planAiTransportAssembly(v,rear).wait,false);
});
test('Neutral, unsupplied and disconnected empty hulls do not delay departure',()=>{
 const {v,lead}=recruiting();v.cells[30*v.width+50].city.owner=null;assert.equal(planAiTransportAssembly(v,lead).wait,false);
 v.cells[30*v.width+50].city.owner='blue';v.ownCities[0].production='fighter';assert.equal(planAiTransportAssembly(v,lead).wait,false);
 v.ownCities[0].production='army';v.ownCities[0].position={x:41,y:30};v.ownUnits.find(u=>u.id==='rear').position={x:41,y:30};
 v.cells[30*v.width+43]={terrain:'sea',visible:true,city:null};v.cells[30*v.width+41]={terrain:'land',visible:true,city:{id:'supply',owner:'red'}};
 for(let y=27;y<=33;y++)v.cells[y*v.width+42].terrain='land';assert.equal(planAiTransportAssembly(v,lead).wait,false);
});
