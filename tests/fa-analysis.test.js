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
  assert.equal(result.engine, 'landmark-fa-v2');
  assert.equal(result.leaves[1].fa, Number((result.leaves[1].traits.width / 5).toFixed(6)));
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
  assert.equal(result.fa, Number((Object.values(result.traits).reduce((a,b)=>a+b,0)/5).toFixed(6)));
});
