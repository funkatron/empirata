import test from 'node:test';
import assert from 'node:assert/strict';
import {
  exportSave,
  gameOutcome,
  importSave,
  livingFactions,
  makeCampaignMap,
  makeRulesLab,
  playRedOpponent,
  respondClassicResign,
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

test('shouldOfferClassicResign never applies to computer-vs-computer spectators', () => {
  const g = makeCampaignMap('continents', 17, 'ai-vs-ai', false, { density: 'sparse' });
  g.round = 200;
  for (const c of g.cities) c.owner = 'blue';
  assert.equal(shouldOfferClassicResign(g, 'red'), false);
});

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
  assert.deepEqual(next.classicResignPending, { computer: 'red', human: 'blue', round: next.round });
  const again = playRedOpponent(next);
  assert.equal(again.events.filter(e => e.message.includes('resign')).length, next.events.filter(e => e.message.includes('resign')).length);
  assert.deepEqual(importSave(exportSave(next)).classicResignOffered, { red: true });
  assert.deepEqual(importSave(exportSave(next)).classicResignPending, next.classicResignPending);
});

test('respondClassicResign accept transfers cities and clears units', () => {
  const g = playRedOpponent(classicCvC(101, 0));
  const accepted = respondClassicResign(g, true);
  assert.equal(accepted.classicResignPending, undefined);
  assert.ok(accepted.cities.every(c => c.owner !== 'red'));
  assert.equal(accepted.units.filter(u => u.owner === 'red').length, 0);
});

test('respondClassicResign accept eliminates computer from living factions and finishes the game', () => {
  const g = playRedOpponent(classicCvC(101, 0));
  const accepted = respondClassicResign(g, true);
  assert.deepEqual(livingFactions(accepted), ['blue']);
  assert.deepEqual(gameOutcome(accepted), { state: 'finished', winner: 'blue', eliminated: ['red'] });
});

test('respondClassicResign decline keeps computer in play', () => {
  const base = classicCvC(101, 1);
  assert.ok(shouldOfferClassicResign(base, 'red'));
  const g = playRedOpponent(base);
  const declined = respondClassicResign(g, false);
  assert.equal(declined.classicResignPending, undefined);
  assert.ok(declined.cities.some(c => c.owner === 'red'));
  assert.ok(declined.units.some(u => u.owner === 'red'));
});