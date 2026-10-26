import test from 'node:test';
import assert from 'node:assert/strict';
import {
  makeAiInvasionLab,advanceLabRound,updateAllKnowledge,
  exportSave,importSave,requiredProductionTurns,getPlayerView
} from '../dist/engine/index.js';

const own=(g,kind)=>g.units.filter(u=>u.owner==='red'&&u.kind===kind);
const at=(g,id)=>g.units.find(u=>u.id===id);

/** Production-to-invasion lab: no starting transport, no instant ship grant. */
function campaign(){
  const g=makeAiInvasionLab();
  g.units=g.units.filter(u=>u.id!=='red-transport');
  const army=at(g,'u3');
  army.aboard=null;
  army.position={x:79,y:36};
  army.spent=0;
  const home=g.cities.find(c=>c.id==='c-red');
  home.production='transport';
  home.progress=requiredProductionTurns('transport',true,50)-1;
  home.firstCycle=true;
  // An open sea lane links the production harbor to the target island.
  // Without this the generated ship is trapped in an isolated coastal inlet.
  for(let y=32;y<=36;y++)for(const x of [81,82])
    g.tiles[y*g.width+x]='sea';
  // Three armies give Red a reason to continue building transports.
  for(const [id,x,y] of [['reserve-1',79,35],['reserve-2',80,35]]){
    g.tiles[y*g.width+x]='land';
    g.units.push({...structuredClone(army),id,position:{x,y}});
  }
  // Retain the scouting memory from makeAiInvasionLab; Red must still route
  // using its own knowledge rather than omniscient world data.
  updateAllKnowledge(g);
  return g;
}
function tick(g,n){for(let i=0;i<n;i++)g=advanceLabRound(g);return g;}

test('Production creates a transport, Red loads it, and begins an overseas voyage',()=>{
  const initial=campaign();
  assert.equal(own(initial,'transport').length,0);
  let g=advanceLabRound(initial);
  assert.equal(own(g,'transport').length,1,'Ship must be produced by city rules');
  assert.ok(own(g,'army').some(u=>u.aboard),'At least one army must board');
  const ship=own(g,'transport')[0];
  assert.ok(ship.spent>0,'Loaded ship should sail toward the remembered outpost');
  assert.equal(g.cities.find(c=>c.id==='c-red').production,'army');
  assert.equal(initial.units.some(u=>u.aboard),false,'The fixture begins without embarked troops');
});

test('A produced transport completes a bounded amphibious campaign',()=>{
  let g=campaign(),built=false,loaded=false,landed=false,contested=false;
  const trace=[];
  for(let i=0;i<32;i++){
    g=advanceLabRound(g);
    trace.push({round:g.round,ships:own(g,'transport').map(u=>({id:u.id,p:u.position})),
      armies:own(g,'army').map(u=>({id:u.id,p:u.position,aboard:u.aboard})),
      owner:g.cities.find(c=>c.id==='invasion-outpost').owner});
    built ||= own(g,'transport').length>0;
    loaded ||= own(g,'army').some(u=>u.aboard);
    landed ||= own(g,'army').some(u=>!u.aboard&&u.position.x<=76&&u.position.y<=32);
    contested ||= g.cities.find(c=>c.id==='invasion-outpost').owner==='red';
    if(contested)break;
  }
  assert.ok(built,'Red must build a transport');
  assert.ok(loaded,'Red must load an army');
  assert.ok(landed,'Red must land an army on the target island: '+JSON.stringify(trace));
  assert.ok(contested,'Red must capture the outpost in the bounded scenario');
});

test('A campaign replay after saving mid-voyage remains byte-for-byte deterministic',()=>{
  let a=tick(campaign(),2);
  let b=importSave(exportSave(a));
  for(let round=0;round<8;round++){
    a=advanceLabRound(a);
    b=advanceLabRound(b);
    assert.deepEqual(b,a,`Replay diverged on resumed round ${round+1}`);
  }
});

test('Sinking a transport and its cargo triggers replacement production',()=>{
  let g=advanceLabRound(campaign());
  const ship=own(g,'transport')[0];
  const lostIds=new Set([ship.id,...g.units.filter(u=>u.aboard===ship.id).map(u=>u.id)]);
  assert.ok(lostIds.size>1,'There must be cargo to lose');
  // Scripted attrition fixture; combat lethality is tested separately.
  g.units=g.units.filter(u=>!lostIds.has(u.id));
  // Leave three replacement troops at home, as would happen after earlier
  // production cycles. The AI must detect that its transport is gone.
  const base=own(g,'army')[0]??{...at(campaign(),'u3')};
  for(let i=0;i<3;i++)
    g.units.push({...structuredClone(base),id:`replacement-${i}`,aboard:null,
      position:{x:79+(i===2?1:0),y:36-(i===1?1:0)},spent:0,order:{kind:'none'}});
  updateAllKnowledge(g);
  g=advanceLabRound(g);
  assert.equal(g.cities.find(c=>c.id==='c-red').production,'transport');
  assert.ok(!g.units.some(u=>lostIds.has(u.id)),'Sunk cargo must not reappear');
  assert.ok(getPlayerView(g,'red').ownUnits.every(u=>!u.aboard||g.units.some(ship=>ship.id===u.aboard)));
});
