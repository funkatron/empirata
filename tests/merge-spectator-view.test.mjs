import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getPlayerView,
  makeAiVsAiLab,
  mergeSpectatorPlayerViews,
} from '../dist/engine/index.js';

test('mergeSpectatorPlayerViews unions visibility and both factions’ own units', () => {
  const game = makeAiVsAiLab();
  const blue = getPlayerView(game, 'blue');
  const red = getPlayerView(game, 'red');
  const merged = mergeSpectatorPlayerViews(blue, red);
  assert.equal(merged.width, game.width);
  assert.equal(merged.height, game.height);
  assert.equal(merged.ownUnits.length, blue.ownUnits.length + red.ownUnits.length);
  assert.equal(merged.ownCities.length, blue.ownCities.length + red.ownCities.length);
  const blueVisible = blue.cells.filter(c => c.visible).length;
  const redVisible = red.cells.filter(c => c.visible).length;
  const mergedVisible = merged.cells.filter(c => c.visible).length;
  assert.ok(mergedVisible >= blueVisible);
  assert.ok(mergedVisible >= redVisible);
});

test('mergeSpectatorPlayerViews clears conflicting city ownership intel', () => {
  const game = makeAiVsAiLab();
  const blue = getPlayerView(game, 'blue');
  const red = getPlayerView(game, 'red');
  const idx = 40 * game.width + 40;
  blue.cells[idx] = {
    ...blue.cells[idx],
    visible: true,
    city: { id: 'disputed', owner: 'blue', production: null, productionKnown: false },
  };
  red.cells[idx] = {
    ...red.cells[idx],
    visible: true,
    city: { id: 'disputed', owner: 'red', production: null, productionKnown: false },
  };
  const merged = mergeSpectatorPlayerViews(blue, red);
  assert.equal(merged.cells[idx].city?.owner, null);
});