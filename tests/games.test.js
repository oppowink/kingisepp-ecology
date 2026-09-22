'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { RoadGame, SortGame, ModeratorGame, SITES } = require('../js/games');

test('road game accepts a complete passport and rejects a wrong one', function () {
  const game = new RoadGame();
  assert.equal(game.savePassport('road', { territory: 'street', surface: 'soil', distance: 'near' }), false);
  assert.equal(game.savePassport('road', Object.assign({}, SITES.road.fields)), true);
  assert.equal(game.pick('road'), true);
  assert.equal(game.collect(), true);
  assert.equal(game.counts.road, 1);
});

test('road game finishes only after five samples from both places', function () {
  const game = new RoadGame();
  ['road', 'park'].forEach(function (site) {
    assert.equal(game.savePassport(site, Object.assign({}, SITES[site].fields)), true);
    for (let index = 0; index < 5; index += 1) {
      assert.equal(game.pick(site), true);
      assert.equal(game.collect(), true);
    }
  });
  assert.equal(game.complete, true);
  assert.equal(game.conclude('more'), true);
});

test('sort game does not advance after a wrong container', function () {
  const game = new SortGame(function () { return 0.5; });
  const wrong = ['normal', 'damaged', 'other'].find(function (value) { return value !== game.current.category; });
  assert.equal(game.drop(wrong), false);
  assert.equal(game.advance(), false);
  assert.equal(game.drop(game.current.category), true);
  assert.equal(game.advance(), true);
  assert.equal(game.index, 1);
});

test('moderator game records one decision per application', function () {
  const game = new ModeratorGame();
  assert.equal(game.decide(game.current.expected).correct, true);
  assert.equal(game.decide('reject'), null);
  assert.equal(game.advance(), true);
  assert.equal(game.index, 1);
});
