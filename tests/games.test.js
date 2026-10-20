'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { RoadGame, SortGame, ModeratorGame, GameProgress, SITES } = require('../js/games');

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

test('burst collection preserves the source and passport of each leaf', function () {
  const game = new RoadGame();
  assert.equal(game.pick('road'), false);
  for (const site of ['road', 'park']) {
    game.savePassport(site, { ...SITES[site].fields });
    for (let i=0; i<5; i++) assert.equal(game.pick(site), true);
    assert.equal(game.pick(site), false);
  }
  assert.equal(game.total, 0);
  assert.equal(game.selectSample('park'), true);
  assert.equal(game.collect(), true);
  assert.equal(game.samples[0].site, 'park');
  assert.deepEqual(game.samples[0].passport, SITES.park.fields);
  assert.equal(game.counts.road, 0);
  assert.equal(game.waiting.park, 4);
  while(game.collect()) {}
  assert.equal(game.total, 10);
  assert.equal(game.collect(), false);
  assert.equal(game.selectSample('park'), false);
  assert.equal(game.conclude('cause'), false);
  assert.equal(game.conclude('more'), true);
});

test('completed games survive reload and ignore unknown stored values', function () {
  const values=new Map([['eco-games-completed-v1', '["road","unknown",null]']]);
  const storage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)};
  const progress=new GameProgress(storage);
  assert.equal(progress.has('road'), true);
  assert.equal(progress.has('unknown'), false);
  progress.mark('leaves'); progress.mark('leaves'); progress.mark('unknown');
  const reloaded=new GameProgress(storage);
  assert.deepEqual(Array.from(reloaded.completed), ['road','leaves']);
});

test('games remain usable when browser storage is blocked or corrupt', function () {
  const blocked={getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}};
  const progress=new GameProgress(blocked);
  progress.mark('moderator');
  assert.equal(progress.has('moderator'), true);
  assert.equal(new GameProgress({getItem(){return '{broken'}}).completed.size, 0);
});

test('sorter checks all nine leaves without skipping corrected answers', function () {
  const game=new SortGame(()=>.5);
  for(let i=0;i<9;i++) {
    const correct=game.current.category;
    if(i===0) assert.equal(game.drop(['normal','damaged','other'].find(v=>v!==correct)),false);
    assert.equal(game.drop(correct),true);
    assert.equal(game.advance(),true);
  }
  assert.equal(game.sorted,9);
  assert.equal(game.firstTry,8);
  assert.equal(game.errors,1);
  assert.deepEqual(game.bins,{normal:3,damaged:3,other:3});
});
