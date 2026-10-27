import test from 'node:test';
import assert from 'node:assert/strict';
import {planAiNavalScoutStep} from '../dist/engine/index.js';

function fixture(){
  const width=12,height=12;
  const cells=Array.from({length:width*height},()=>({terrain:'land',city:null,visible:true}));
  for(let x=2;x<=8;x++)cells[5*width+x].terrain='sea';
  // A weak northern frontier near the starting position.
  cells[4*width+3].terrain=null;
  // A richer, more distant frontier with four unexplored neighbors.
  for(const [x,y] of [[7,4],[8,4],[9,4],[9,5]])cells[y*width+x].terrain=null;
  const ship={id:'scout',kind:'destroyer',owner:'red',aboard:null,position:{x:2,y:5}};
  const view={width,height,cells,ownUnits:[ship],enemies:[],ownCities:[],events:[],active:'red',round:1};
  return {view,ship};
}

test('Naval scouting favors information gain per route distance, not nearest unknown',()=>{
  const {view,ship}=fixture();
  const next=planAiNavalScoutStep(view,ship);
  assert.deepEqual(next,{x:3,y:5},'Move toward the highest-scoring reachable frontier');
  // The first step is the same in this corridor; verify destination choice
  // by making a second competing branch with a closer but weaker frontier.
  for(let y=3;y<=5;y++)view.cells[y*view.width+2].terrain='sea';
  view.cells[2*view.width+2].terrain=null;
  const chosen=planAiNavalScoutStep(view,ship);
  assert.deepEqual(chosen,{x:2,y:4},'Nearby branch yields more information per travel step');
});

test('Naval scout does not treat unknown terrain as a traversable sea corridor',()=>{
  const {view,ship}=fixture();
  view.cells[5*view.width+3].terrain=null;
  assert.equal(planAiNavalScoutStep(view,ship),null,
    'Unknown squares are not assumed to connect distant seas');
});

test('Naval scout avoids fresh contacts and uses only supplied faction view',()=>{
  const {view,ship}=fixture();
  const original=structuredClone(view);
  view.enemies.push({id:'hostile',kind:'submarine',owner:'blue',position:{x:3,y:5},stale:false});
  assert.equal(planAiNavalScoutStep(view,ship),null);
  assert.deepEqual(planAiNavalScoutStep(original,ship),{x:3,y:5});
});

test('Non-destroyers do not receive the dedicated destroyer scout route',()=>{
  const {view,ship}=fixture();
  assert.equal(planAiNavalScoutStep(view,{...ship,kind:'transport'}),null);
});
