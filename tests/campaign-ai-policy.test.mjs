import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_AI_POLICY,
  exportSave,
  formatAiPolicyLabel,
  importSave,
  LEGACY_IMPLICIT_AI_POLICY,
  makeCampaignMap,
  makeRulesLab,
  resolveAiPolicy,
} from '../dist/engine/index.js';

test('makeCampaignMap defaults to classic DOS grade 1', () => {
  const g = makeCampaignMap('continents', 17, 'user-vs-computer', false, { density: 'sparse' });
  assert.deepEqual(g.aiPolicy, DEFAULT_AI_POLICY);
  assert.equal(resolveAiPolicy(g).kind, 'classic-dos');
  assert.equal(resolveAiPolicy(g).grade, 1);
});

test('Rules lab without aiPolicy still resolves legacy modern', () => {
  const g = makeRulesLab();
  assert.equal(g.aiPolicy, undefined);
  assert.deepEqual(resolveAiPolicy(g), LEGACY_IMPLICIT_AI_POLICY);
});

test('makeCampaignMap stores classic grade and round-trips in saves', () => {
  const policy = { kind: 'classic-dos', grade: 2 };
  const g = makeCampaignMap('islands', 83, 'user-vs-computer', false, {
    algorithm: 'ellipse-v1',
    density: 'sparse',
    aiPolicy: policy,
  });
  assert.deepEqual(g.aiPolicy, policy);
  assert.ok(g.events.some(e => e.message.includes('Classic DOS')));
  assert.deepEqual(importSave(exportSave(g)).aiPolicy, policy);
});

test('formatAiPolicyLabel names modern and classic grades', () => {
  assert.match(formatAiPolicyLabel({ kind: 'modern-experimental' }), /Modern/);
  assert.match(formatAiPolicyLabel({ kind: 'classic-dos', grade: 1 }), /grade 1/);
});