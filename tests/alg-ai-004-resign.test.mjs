import test from 'node:test';
import assert from 'node:assert/strict';
import {
  exportSave,
  importSave,
  makeRulesLab,
  playRedOpponent,
  shouldOfferClassicResign,
} from '../dist/engine/index.js';

function classicCvC(round, redCities) {
  const g = makeRulesLab();
  g.round = round;
  g.aiPolicy = { kind: 'classic-dos', grade: 1 };
  g.players = g.players.filter(p => p.id === 'blue' || p.id === 'red');
  g.active = 'red';
  let i = 0;
  for (const c of g.cities) {
    if (c.owner === 'red') {
      if (i >= redCities) c.owner = 'blue';
      i++;
    }
  }
  return g;
}

test('shouldOfferClassicResign enforces ALG-AI-004 threshold table', () => {
  assert.equal(shouldOfferClassicResign(classicCvC(50, 0), 'red'), false);
  const dominant = classicCvC(101, 0);
  for (const c of dominant.cities) c.owner = 'red';
  dominant.cities[0].owner = 'blue';
  dominant.cities[1].owner = 'blue';
  assert.equal(shouldOfferClassicResign(dominant, 'red'), false);
  const offer = classicCvC(101, 0);
  assert.equal(shouldOfferClassicResign(offer, 'red'), true);
  offer.classicResignOffered = { red: true };
  assert.equal(shouldOfferClassicResign(offer, 'red'), false);
});

test('Classic turn emits one resign notice and persists classicResignOffered', () => {
  const g = classicCvC(101, 0);
  const next = playRedOpponent(g);
  assert.equal(next.classicResignOffered?.red, true);
  assert.ok(next.events.some(e => e.recipient === 'blue' && e.message.includes('resign')));
  const again = playRedOpponent(next);
  assert.equal(again.events.filter(e => e.message.includes('resign')).length, next.events.filter(e => e.message.includes('resign')).length);
  assert.deepEqual(importSave(exportSave(next)).classicResignOffered, { red: true });
});