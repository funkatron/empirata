import test from 'node:test';
import assert from 'node:assert/strict';
import {dosAiModeFlags,dosAiCombatFactor,dosAiGradeBFlag} from '../dist/engine/index.js';

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

test('ALG-AI-003: reject invalid grades rather than inventing difficulty',()=>{
  for(const grade of [0,3,-1,1.5]){
    assert.throws(()=>dosAiModeFlags(grade));
    assert.throws(()=>dosAiCombatFactor(grade));
    assert.throws(()=>dosAiGradeBFlag(grade));
  }
});
