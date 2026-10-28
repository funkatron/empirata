import test from 'node:test';
import assert from 'node:assert/strict';
import {
  makeRulesLab,makeAiInvasionLab,advanceLabRound,updateAllKnowledge,getPlayerView,planAiLandingSquares
} from '../dist/engine/index.js';

const unit=(g,id)=>g.units.find(u=>u.id===id);
const range=(a,b)=>Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y));

/** A tiny island-to-island lab scenario, not a copy of the DOS campaign map. */
function invasionFixture(){
  const g=makeRulesLab();
  g.scenario='ai-invasion';
  g.rng={seed:1,draws:0};
  // A straight deep-water passage and a small landfall around 74,29.
  for(let y=28;y<=32;y++)for(let x=72;x<=83;x++)
    g.tiles[y*g.width+x]='sea';
  for(const x of [74,75])g.tiles[29*g.width+x]='land';
  g.cities.push({id:'invasion-objective',position:{x:74,y:29},owner:null,
    production:null,progress:0,firstCycle:true});
  const army=unit(g,'u3');
  army.position={x:81,y:30};
  army.aboard='red-transport';
  const ship={...structuredClone(army),id:'red-transport',kind:'transport',
    position:{x:81,y:30},aboard:null,fuel:null};
  g.units.push(ship);
  // Red learned of the target during an earlier reconnaissance visit.
  g.units.push({...structuredClone(army),id:'red-scout',aboard:null,position:{x:74,y:30}});
  updateAllKnowledge(g);
  g.units=g.units.filter(u=>u.id!=='red-scout');
  updateAllKnowledge(g);
  return g;
}

test('Invasion planner navigates toward remembered enemy coastline without DOS emulation',()=>{
  let g=invasionFixture();
  const initial=structuredClone(g);
  assert.ok(getPlayerView(g,'red').cells[29*100+74].city);
  g=advanceLabRound(g);
  assert.deepEqual(initial.units.find(u=>u.id==='red-transport').position,{x:81,y:30});
  assert.ok(range(unit(g,'red-transport').position,{x:74,y:29}) <
    range(initial.units.find(u=>u.id==='red-transport').position,{x:74,y:29}));
  assert.equal(unit(g,'u3').aboard,'red-transport');
});

test('AI invasion eventually lands an army and contests a discovered neutral city',()=>{
  let g=invasionFixture();
  let landed=false,claimed=false;
  const trace=[];
  for(let i=0;i<15;i++){
    g=advanceLabRound(g);
    const army=unit(g,'u3');
    trace.push({round:g.round,army:army?{pos:army.position,aboard:army.aboard}:null,
      ship:unit(g,'red-transport')?.position,owner:g.cities.find(c=>c.id==='invasion-objective').owner});
    if(army&&!army.aboard)landed=true;
    if(g.cities.find(c=>c.id==='invasion-objective').owner==='red'){
      claimed=true;break;
    }
  }
  assert.ok(landed,'A transported Red army should reach a legal landing square');
  assert.ok(claimed,'Red should capture the known neutral objective with seed 1; '+JSON.stringify(trace));
});

test('Invasion decision does not consult unseen alternative destinations',()=>{
  const a=invasionFixture(),b=structuredClone(a);
  b.cities.push({id:'hidden-target',position:{x:27,y:26},owner:'blue',
    production:null,progress:0,firstCycle:true});
  // This city is outside Red's visibility and was never explored.
  updateAllKnowledge(a);updateAllKnowledge(b);
  assert.deepEqual(getPlayerView(a,'red'),getPlayerView(b,'red'));
  const nextA=advanceLabRound(a),nextB=advanceLabRound(b);
  assert.deepEqual(unit(nextA,'red-transport').position,unit(nextB,'red-transport').position);
  assert.deepEqual(nextA.rng,nextB.rng);
});

test('Playable AI Invasion scenario runs the opponent and brings transport to its outpost',()=>{
  let g=makeAiInvasionLab();
  assert.equal(g.scenario,'ai-invasion');
  assert.equal(g.cities.find(c=>c.id==='invasion-outpost').owner,'blue');
  assert.equal(unit(g,'u3').aboard,'red-transport');
  assert.deepEqual(unit(g,'red-transport').position,{x:81,y:30});
  g=advanceLabRound(g);
  assert.notDeepEqual(unit(g,'red-transport').position,{x:81,y:30});
  assert.equal(g.active,'blue');
});

test('Playable invasion captures an undefended outpost within bounded rounds',()=>{
  let g=makeAiInvasionLab(),claimed=false;
  const trace=[];
  for(let round=0;round<15;round++){
    g=advanceLabRound(g);
    trace.push({round:g.round,army:unit(g,'u3')?.position,aboard:unit(g,'u3')?.aboard,
      ship:unit(g,'red-transport')?.position,owner:g.cities.find(c=>c.id==='invasion-outpost').owner});
    if(g.cities.find(c=>c.id==='invasion-outpost').owner==='red'){
      claimed=true;break;
    }
  }
  assert.equal(claimed,true,'Red should complete the island invasion: '+JSON.stringify(trace));
});

test('Landing planner chooses a safe beach instead of one adjacent to a known enemy army',()=>{
  const g=makeAiInvasionLab(),view=getPlayerView(g,'red');
  const ship={...unit(g,'red-transport'),position:{x:75,y:30}};
  // A two-tile charted beach within reach of the same known city.
  for(const x of [74,75])view.cells[29*view.width+x].terrain='land';
  view.cells[29*view.width+74].city=null;
  view.cells[29*view.width+73].terrain='land';
  view.cells[29*view.width+73].city={id:'invasion-outpost',owner:'blue',
    production:null,productionKnown:false};
  view.enemies.push({id:'visible-defender',kind:'army',owner:'blue',
    position:{x:73,y:29},stale:false});
  const choices=planAiLandingSquares(view,ship);
  assert.deepEqual(choices[0],{x:75,y:29});
  assert.ok(!choices.some(p=>p.x===74&&p.y===29),
    'Known adjacent enemy army must rule out the exposed beach');
});

test('Stale army sightings warn the landing planner without permanently blocking a beach',()=>{
  const g=makeAiInvasionLab(),view=getPlayerView(g,'red');
  const ship={...unit(g,'red-transport'),position:{x:75,y:30}};
  for(const x of [74,75])view.cells[29*view.width+x].terrain='land';
  view.cells[29*view.width+74].city=null;
  view.cells[29*view.width+73].terrain='land';
  view.cells[29*view.width+73].city={id:'invasion-outpost',owner:'blue',
    production:null,productionKnown:false};
  view.enemies.push({id:'old-defender',kind:'army',owner:'blue',
    position:{x:73,y:29},stale:true});
  const choices=planAiLandingSquares(view,ship);
  assert.ok(choices.some(p=>p.x===74&&p.y===29),
    'Stale sightings must not permanently prohibit landing');
  assert.deepEqual(choices[0],{x:75,y:29},
    'Prefer the beach farther from a stale army sighting');
});

test('Landing planner uses faction knowledge, not a hidden hostile army',()=>{
  const a=makeAiInvasionLab(),b=structuredClone(a);
  // An enemy army well outside the currently revealed area is not intelligence.
  b.units.push({...structuredClone(unit(a,'u3')),id:'hidden-army',owner:'blue',
    aboard:null,position:{x:30,y:25}});
  updateAllKnowledge(a);updateAllKnowledge(b);
  const va=getPlayerView(a,'red'),vb=getPlayerView(b,'red');
  assert.deepEqual(va,vb,'Unseen units must not change Red intelligence');
  const ship=unit(a,'red-transport');
  assert.deepEqual(planAiLandingSquares(va,ship),planAiLandingSquares(vb,ship));
});
