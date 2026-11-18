import test from 'node:test';
import assert from 'node:assert/strict';
import {combatEfficiency,dosAiModeFlags,dosAiCombatFactor,dosAiGradeBFlag,makeRulesLab} from '../dist/engine/index.js';

test('ALG-AI-003: grade A clears all twelve DOS mode bytes',()=>{
  assert.deepEqual(dosAiModeFlags(1),Array(12).fill(0));
  assert.equal(dosAiCombatFactor(1),4);
  assert.equal(dosAiGradeBFlag(1),0);
});

test('ALG-AI-003: grade B sets all twelve DOS mode bytes',()=>{
  assert.deepEqual(dosAiModeFlags(2),Array(12).fill(1));
  assert.equal(dosAiModeFlags(2)[4],1); // ES:62F0 aliases ES:62E8[4]
  assert.equal(dosAiCombatFactor(2),5);
  assert.equal(dosAiGradeBFlag(2),1);
});

test('ALG-AI-003: classic combat efficiency applies DE40 factor 4 or 5',()=>{
  const g=makeRulesLab();
  g.aiPolicy={kind:'classic-dos',grade:2};
  assert.equal(combatEfficiency(g,'red'),50);
  g.aiPolicy={kind:'classic-dos',grade:1};
  assert.equal(combatEfficiency(g,'red'),40);
  g.aiPolicy={kind:'modern-experimental'};
  assert.equal(combatEfficiency(g,'red'),50);
});

test('ALG-AI-003: reject invalid grades rather than inventing difficulty',()=>{
  for(const grade of [0,3,-1,1.5]){
    assert.throws(()=>dosAiModeFlags(grade));
    assert.throws(()=>dosAiCombatFactor(grade));
    assert.throws(()=>dosAiGradeBFlag(grade));
  }
});
