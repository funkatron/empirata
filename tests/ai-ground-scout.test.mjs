import test from 'node:test';
import assert from 'node:assert/strict';
import {planAiGroundScoutStep} from '../dist/engine/index.js';

function fixture(){
  const width=12,height=12;
  const cells=Array.from({length:width*height},()=>({terrain:'sea',city:null,visible:true}));
  for(let x=2;x<=8;x++)cells[5*width+x].terrain='land';
  // A weak northern frontier near the starting position.
  cells[4*width+3].terrain=null;
  // A richer, more distant frontier with four unexplored neighbors.
  for(const [x,y] of [[7,4],[8,4],[9,4],[9,5]])cells[y*width+x].terrain=null;
  const ship={id:'scout',kind:'army',owner:'red',aboard:null,position:{x:2,y:5}};
  const view={width,height,cells,ownUnits:[ship],enemies:[],ownCities:[],events:[],active:'red',round:1};
  return {view,ship};
}

test('Ground scouting favors information gain per route distance, not nearest unknown',()=>{
  const {view,ship}=fixture();
  const next=planAiGroundScoutStep(view,ship);
  assert.deepEqual(next,{x:3,y:5},'Move toward the highest-scoring reachable frontier');
  // The first step is the same in this corridor; verify destination choice
  // by making a second competing branch with a closer but weaker frontier.
  for(let y=3;y<=5;y++)view.cells[y*view.width+2].terrain='land';
  view.cells[2*view.width+2].terrain=null;
  const chosen=planAiGroundScoutStep(view,ship);
  assert.deepEqual(chosen,{x:2,y:4},'Nearby branch yields more information per travel step');
});

test('Ground scout does not treat unknown terrain as a traversable land corridor',()=>{
  const {view,ship}=fixture();
  view.cells[5*view.width+3].terrain=null;
  assert.equal(planAiGroundScoutStep(view,ship),null,
    'Unknown squares are not assumed to connect distant land');
});

test('Ground scout avoids fresh contacts and uses only supplied faction view',()=>{
  const {view,ship}=fixture();
  const original=structuredClone(view);
  view.enemies.push({id:'hostile',kind:'submarine',owner:'blue',position:{x:3,y:5},stale:false});
  assert.equal(planAiGroundScoutStep(view,ship),null);
  assert.deepEqual(planAiGroundScoutStep(original,ship),{x:3,y:5});
});

test('Non-armies do not receive the dedicated ground scout route',()=>{
  const {view,ship}=fixture();
  assert.equal(planAiGroundScoutStep(view,{...ship,kind:'transport'}),null);
});
