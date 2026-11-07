import test from 'node:test';
import assert from 'node:assert/strict';
import {makeRulesLab, getPlayerView, planAiFighterStep} from '../dist/engine/index.js';

function distantFrontier() {
  const view=getPlayerView(makeRulesLab(),'blue');
  view.cells=view.cells.map(()=>({terrain:'land',visible:false,city:null}));
  view.enemies=[];
  const origin={x:30,y:30}, forward={x:18,y:30};
  view.ownCities=[
    {id:'home',owner:'blue',position:origin},
    {id:'forward',owner:'blue',position:forward},
  ];
  for(const city of view.ownCities)view.cells[city.position.y*view.width+city.position.x].city=city;
  const fighter={...view.ownUnits[0],id:'air',kind:'fighter',owner:'blue',position:origin,fuel:20,aboard:null};
  view.ownUnits=[fighter];
  view.cells[30*view.width+10].terrain=null;
  return {view,fighter};
}

test('Idle fighter relocates toward a frontier beyond its current sortie range',()=>{
  const {view,fighter}=distantFrontier(),before=structuredClone(view);
  const step=planAiFighterStep(view,fighter);
  assert.ok(step);
  assert.ok(step.x<fighter.position.x);
  assert.deepEqual(view,before);
  // A subsequent airborne planning call must continue toward a safe base.
  fighter.position=step;
  fighter.fuel=19;
  assert.ok(planAiFighterStep(view,fighter));
});

test('Fully explored map still supports rebasing toward a stale land contact',()=>{
  const {view,fighter}=distantFrontier();
  view.cells[30*view.width+10].terrain='land';
  view.enemies=[{id:'old',owner:'red',kind:'army',position:{x:10,y:30},stale:true,observedRound:1}];
  assert.ok(planAiFighterStep(view,fighter));
  view.enemies=[];
  assert.equal(planAiFighterStep(view,fighter),null);
});

test('Rebasing requires a reachable city and fuel margin',()=>{
  const {view,fighter}=distantFrontier();
  fighter.fuel=12;
  assert.equal(planAiFighterStep(view,fighter),null);
  fighter.fuel=20;
  view.ownCities[1].position={x:5,y:30};
  assert.equal(planAiFighterStep(view,fighter),null);
});

test('Ground and naval scouts investigate remembered contacts on charted terrain',async()=>{
  const {planAiGroundScoutStep,planAiNavalScoutStep}=await import('../dist/engine/index.js');
  for(const [kind,terrain,plan] of [
    ['army','land',planAiGroundScoutStep],
    ['destroyer','sea',planAiNavalScoutStep],
  ]){
    const {view,fighter}=distantFrontier();
    view.cells=view.cells.map(()=>({terrain,visible:false,city:null}));
    fighter.kind=kind;
    view.enemies=[{id:'old',owner:'red',kind:'army',position:{x:34,y:30},stale:true,observedRound:1}];
    const before=structuredClone(view),step=plan(view,fighter);
    assert.ok(step);
    assert.ok(step.x>fighter.position.x);
    assert.deepEqual(view,before);
    view.enemies=[];
    assert.equal(plan(view,fighter),null);
  }
});

test('AI completes a long transfer, survives, and resumes scouting after save/reload',async()=>{
  const {playAiOpponent,endTurn,emptyKnowledge,updateAllKnowledge,exportSave,importSave}=await import('../dist/engine/index.js');
  let game=makeRulesLab();
  game.tiles.fill('land');
  const original=game.units[0];
  game.cities=[
    {id:'home',owner:'blue',position:{x:30,y:30},production:'army',progress:0,firstCycle:false},
    {id:'forward',owner:'blue',position:{x:14,y:30},production:'army',progress:0,firstCycle:false},
    {id:'red-home',owner:'red',position:{x:80,y:40},production:'army',progress:0,firstCycle:false},
  ];
  game.units=[
    {...structuredClone(original),id:'air',owner:'blue',kind:'fighter',position:{x:30,y:30},aboard:null,fuel:20},
    ...game.cities.filter(c=>c.owner==='blue').map(c=>({...structuredClone(original),id:c.id+'-guard',owner:'blue',kind:'army',position:c.position,aboard:null,fuel:null})),
  ];
  game.knowledge.blue=emptyKnowledge(game);
  game.knowledge.blue.terrain=[...game.tiles];
  for(let y=28;y<=32;y++)for(let x=5;x<=8;x++)game.knowledge.blue.terrain[y*game.width+x]=null;
  updateAllKnowledge(game);
  const unknown=getPlayerView(game,'blue').cells.filter(c=>c.terrain===null).length;
  let arrived=false;
  for(let turn=0;turn<10;turn++){
    const previous=game.units.find(u=>u.id==='air');
    const replay=importSave(exportSave(game));
    const acted=playAiOpponent(game,'blue');
    assert.deepEqual(acted,playAiOpponent(replay,'blue'));
    const air=acted.units.find(u=>u.id==='air');
    assert.ok(air,'Assigned aircraft survives its transfer and sorties');
    if(previous.aiReconBase==='forward'&&air.fuel>previous.fuel)arrived=true;
    game=endTurn(endTurn(acted));
  }
  assert.ok(arrived,'Aircraft refuels at the forward city');
  assert.ok(getPlayerView(game,'blue').cells.filter(c=>c.terrain===null).length<unknown);
});
