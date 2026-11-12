import test from 'node:test';
import assert from 'node:assert/strict';
import {makeRulesLab,exportSave,importSave} from '../dist/engine/index.js';

test('Legacy games without policy metadata remain importable',()=>{
  const game=makeRulesLab();
  assert.equal(importSave(exportSave(game)).aiPolicy,undefined);
});

test('Modern experimental policy survives save roundtrip',()=>{
  const game=makeRulesLab();
  game.aiPolicy={kind:'modern-experimental'};
  assert.deepEqual(importSave(exportSave(game)).aiPolicy,game.aiPolicy);
});

test('Classic DOS policy cannot be activated before the AI is implemented',()=>{
  const game=makeRulesLab();
  for(const grade of [1,2]){
    game.aiPolicy={kind:'classic-dos',grade};
    assert.throws(()=>importSave(exportSave(game)),/not yet playable/);
  }
});

test('Malformed policy values are rejected',()=>{
  const game=makeRulesLab();
  for(const policy of [{kind:'classic-dos',grade:3},{kind:'modern'},null,{}]){
    const saved=JSON.parse(exportSave(game));
    saved.aiPolicy=policy;
    assert.throws(()=>importSave(JSON.stringify(saved)),/Invalid AI policy/);
  }
});
