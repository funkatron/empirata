import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import {
  endTurn,
  gameOutcome,
  getPlayerView,
  labRoundPhases,
  makeCampaignMap,
} from '../dist/engine/index.js';

const makeCampaignMapExport = makeCampaignMap;

const source = await readFile(new URL('../dist/ui/main.js', import.meta.url), 'utf8');

function harness({ repeat = true, roundsPerAdvance = 1, finishRound = Infinity } = {}) {
  const nodes = new Map();
  const timers = new Map();
  let timerId = 0;
  let paints = 0;
  const saves = [];
  const el = key => {
    if (!nodes.has(key)) nodes.set(key, { textContent: '', hidden: true, disabled: false });
    return nodes.get(key);
  };
  let game = makeCampaignMap('continents', 77, 'ai-vs-ai', false, { density: 'sparse' });
  const c = vm.createContext({
    game,
    observer: 'blue',
    spectatorMode: 'both',
    revealSpectatorTerrain: true,
    gameOutcome: g =>
      g.round >= finishRound ? { state: 'finished', winner: null } : gameOutcome(g),
    el,
    document: { getElementById: el, hidden: false },
    getPlayerView,
    endTurn,
    makeCampaignMap: makeCampaignMapExport,
    labRoundPhases,
    refresh: () => {
      paints++;
    },
    saveLocally: g => {
      saves.push(g.round);
      return Promise.resolve();
    },
    setTimeout: fn => {
      timers.set(++timerId, fn);
      return timerId;
    },
    clearTimeout: key => timers.delete(key),
    window: {},
    performance: { now: () => 0 },
    requestAnimationFrame: fn => fn(),
    cancelAnimationFrame: () => {},
  });
  vm.runInContext(source.slice(source.indexOf('let playback ='), source.indexOf('function resize()')), c);
  vm.runInContext(`roundsPerAdvance=${roundsPerAdvance}`, c);
  return {
    run: s => vm.runInContext(s, c),
    step: () => {
      const next = timers.entries().next().value;
      assert.ok(next, 'expected a pending playback timer');
      const [key, fn] = next;
      timers.delete(key);
      fn();
    },
    game: () => c.game,
    timers: () => timers.size,
    paints: () => paints,
    saves: () => [...saves],
  };
}

test('Classic campaign CvC survives through first production waves (seed 42)', () => {
  const h = harness({ repeat: true, roundsPerAdvance: 1 });
  h.run('game=makeCampaignMap("continents", 42, "ai-vs-ai", false, { density: "sparse" });');
  h.run('startRoundPlayback(true)');
  for (let i = 0; i < 200 && h.game().round < 10; i++) {
    if (h.timers() === 0) break;
    h.step();
  }
  assert.ok(h.game().round >= 10, `stopped early at round ${h.game().round}`);
  assert.ok(h.game().units.length > 0);
});

test('Classic campaign CvC repeat autoplay advances past round 2', () => {
  const h = harness({ repeat: true, roundsPerAdvance: 1 });
  h.run('startRoundPlayback(true)');
  const startRound = h.game().round;
  let steps = 0;
  while (steps < 80 && h.game().round < startRound + 3) {
    if (h.timers() === 0) break;
    h.step();
    steps++;
  }
  assert.ok(
    h.game().round >= startRound + 3,
    `expected ≥3 rounds advanced (started ${startRound}, now ${h.game().round}, steps ${steps}, timers ${h.timers()})`,
  );
  assert.equal(h.game().active, 'blue');
});

test('Classic campaign CvC repeat autoplay keeps scheduling timers', () => {
  const h = harness({ repeat: true, roundsPerAdvance: 1 });
  h.run('startRoundPlayback(true)');
  for (let i = 0; i < 12; i++) h.step();
  assert.ok(h.timers() > 0 || h.game().round > 2, 'playback should continue or advance multiple rounds');
});

test('pausePlayback normalizes an interrupted opponent turn back to blue', () => {
  const h = harness({ repeat: true, roundsPerAdvance: 1 });
  h.run('startRoundPlayback(true)');
  h.step();
  h.run('game.active="red";openRoundPhases=[];openRoundPhaseIndex=0;');
  assert.equal(h.game().active, 'red');
  h.run('pausePlayback()');
  assert.equal(h.game().active, 'blue');
  h.run('startRoundPlayback(true)');
  for (let i = 0; i < 20 && h.game().round < 2; i++) h.step();
  assert.ok(h.game().round >= 2);
  assert.equal(h.game().active, 'blue');
});