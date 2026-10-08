'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateLeaf, calculateRequestFa } = require('../server/fa-analysis');

function symmetricLeaf() {
  return { imageWidth: 1000, imageHeight: 1000, points: {
    apex: { x: .5, y: .05 }, base: { x: .5, y: .95 },
    left_v1_base: { x: .48, y: .8 }, left_v1_end: { x: .2, y: .55 }, right_v1_base: { x: .52, y: .8 }, right_v1_end: { x: .8, y: .55 },
    left_v2_base: { x: .48, y: .7 }, left_v2_end: { x: .15, y: .4 }, right_v2_base: { x: .52, y: .7 }, right_v2_end: { x: .85, y: .4 },
    width_left: { x: .1, y: .5 }, width_right: { x: .9, y: .5 }
  }};
}

test('FA calculator returns zero for a symmetric landmark set', function () {
  const result = calculateLeaf(symmetricLeaf(), 0);
  assert.equal(result.fa, 0);
  assert.deepEqual(Object.keys(result.traits), ['width','secondVein','bases','ends','angle']);
  Object.values(result.traits).forEach(value => assert.equal(value, 0));
});

test('request FA reports leaf count and positive asymmetry', function () {
  const first = symmetricLeaf();
  const second = symmetricLeaf();
  second.points.width_right.x = .75;
  const result = calculateRequestFa([first, second]);
  assert.equal(result.validLeafCount, 2);
  assert.ok(result.meanFa > 0);
  assert.equal(result.engine, 'landmark-fa-v3');
  assert.ok(Math.abs(result.leaves[1].fa - result.leaves[1].traits.width / 5) < 1e-6);
});

test('all five pairs contribute to the leaf result', function () {
  const leaf = symmetricLeaf();
  leaf.points.right_v2_end.x = .76;
  leaf.points.right_v1_base.y = .83;
  leaf.points.right_v1_end.y = .58;
  const result = calculateLeaf(leaf, 0);
  assert.ok(result.traits.secondVein > 0);
  assert.ok(result.traits.bases > 0);
  assert.ok(result.traits.ends > 0);
  assert.ok(result.traits.angle > 0);
  assert.ok(Math.abs(result.fa - Object.values(result.traits).reduce((a,b)=>a+b,0)/5) < 1e-6);
});


test('FA keeps all 150 leaves and rejects invalid geometry instead of dropping it', function () {
  const leaves = Array.from({length: 150}, (_, i) => Object.assign(symmetricLeaf(), {treeIndex: Math.floor(i/30)}));
  const result = calculateRequestFa(leaves);
  assert.equal(result.validLeafCount, 150);
  assert.equal(result.trees.length, 5);
  leaves[149].points.apex = leaves[149].points.base;
  assert.throws(() => calculateRequestFa(leaves), /INVALID_LANDMARK_GEOMETRY/);
});
