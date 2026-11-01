import test from 'node:test';
import assert from 'node:assert/strict';
import {verificationScope,selectScope} from '../scripts/ci-scope.mjs';
const sha='a'.repeat(40);
test('Known display paths qualify; mixed logic and unknown paths require full verification',()=>{
 assert.equal(verificationScope(['src/ui/main.ts','public/styles.css','README.md','src/engine/unit-names.ts']),'focused');
 for(const path of ['src/engine/game.ts','src/engine/presentation.ts','src/engine/save.ts','package.json','.github/workflows/verify.yml','scripts/ci-scope.mjs','unfamiliar.ts'])
  assert.equal(verificationScope(['public/styles.css',path]),'full',path);
 assert.equal(verificationScope([]),'full');
});
test('PR and multi-commit push selection uses the full base-to-tested-HEAD comparison',()=>{
 for(const [name,event] of [['pull_request',{pull_request:{base:{sha}}}],['push',{before:sha}]]){
  assert.equal(selectScope(name,event,base=>{assert.equal(base,sha);return ['public/index.html'];}),'focused');
  assert.equal(selectScope(name,event,()=>['public/index.html','src/engine/game.ts']),'full');
 }
});
test('Manual runs and missing, initial or unavailable comparisons default to full',()=>{
 assert.equal(selectScope('workflow_dispatch',{},()=>['public/styles.css']),'full');
 for(const before of [undefined,'0'.repeat(40),'bad'])assert.equal(selectScope('push',{before},()=>['public/styles.css']),'full');
 assert.equal(selectScope('push',{before:sha},()=>{throw Error('missing history');}),'full');
});
