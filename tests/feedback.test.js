'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { validateFeedback, reserveFeedback } = require('../server/feedback');
test('feedback rejects invalid email and preserves valid plain text', () => {
  assert.throws(() => validateFeedback({topic:'idea',message:'abc',email:'bad'}), /INVALID_FEEDBACK/);
  assert.throws(() => validateFeedback({topic:'anything',message:'abc'}), /INVALID_FEEDBACK/);
  assert.equal(validateFeedback({topic:'idea',message:' Нужен урок ',email:''}).message, 'Нужен урок');
});
test('feedback limits repeated submissions in the same worker', () => {
  for(let i=0;i<5;i++) assert.equal(reserveFeedback('test',1000),true);
  assert.equal(reserveFeedback('test',1000),false);
  assert.equal(reserveFeedback('test',3601000),true);
});
