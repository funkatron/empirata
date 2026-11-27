import test from 'node:test';
import assert from 'node:assert/strict';
import {isLabMessage,reportsHtml} from '../dist/ui/reports.js';

const event=(id,message,kind='system')=>({id,round:1,recipient:'blue',kind,message});
const lab=[
  'Classic DOS AI (grade 1): ALG-AI-002 production + ALG-AI-001 activation pass.',
  'u3 (HMS Test) assigned city objective c1.',
  'u3 (HMS Test) cleared its city objective.',
  'u3 (HMS Test) assembling for c1; wait limited to 12 rounds.',
  'Clean computer campaign: one city each, no starting units.',
];

test('Lab messages are hidden by default and shown on request',()=>{
  const view={width:1,height:1,cells:[null],ownUnits:[],enemies:[],
    events:[event(1,'The computer wishes to resign!'),...lab.map((m,i)=>event(i+2,m))]};
  const hidden=reportsHtml(view,{cities:[]});
  assert.match(hidden,/wishes to resign/);
  assert.doesNotMatch(hidden,/Classic DOS AI|objective|assembling|Clean computer/);
  assert.match(reportsHtml(view,{cities:[]},true),/Classic DOS AI/);
});

test('Only system events can be lab messages',()=>{
  for(const message of lab)assert.equal(isLabMessage(event(1,message)),true,message);
  assert.equal(isLabMessage(event(1,'u3 (X): sentry awakened by adjacent enemy contact.')),false);
  assert.equal(isLabMessage(event(1,lab[0],'combat')),false);
});
