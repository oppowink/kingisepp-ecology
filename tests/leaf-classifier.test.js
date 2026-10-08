'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resizeGeometry, summarize } = require('../js/leaf-classifier');
test('classifier preserves portrait/landscape proportions and pads to 192', () => {
  const portrait = resizeGeometry(800,1200);
  assert.deepEqual(portrait,{width:128,height:192,top:0,left:32,bottom:0,right:32});
  const landscape=resizeGeometry(1200,800);
  assert.equal(landscape.width,192);assert.equal(landscape.height,128);
  assert.equal(landscape.top,32);assert.equal(landscape.bottom,32);
  assert.throws(()=>resizeGeometry(0,0));
});
test('classifier uses exported class order and rejects invalid probabilities', () => {
  assert.equal(summarize([.05,.9,.05]).title,'Повреждённый лист берёзы');
  assert.equal(summarize([.05,.05,.9]).title,'Лист другого вида');
  assert.throws(()=>summarize([.7,.7,.7]));
  assert.throws(()=>summarize([NaN,.5,.5]));
});
