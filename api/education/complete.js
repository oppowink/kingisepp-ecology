'use strict';

const { readSession } = require('../../server/session');
const { getAdminClient } = require('../../server/supabase');

const CORRECT = {
  q1: '30',
  q2: 'betula',
  q3: 'no_damage',
  q4: 'top_light',
  q5: 'tree_coords',
  q6: 'moderation',
  q7: 'after_approval'
};

function readBody(req) {
  return new Promise(function (resolve, reject) {
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    if (typeof req.body === 'string') {
      try {
        return resolve(req.body ? JSON.parse(req.body) : {});
      } catch (error) {
        return reject(error);
      }
    }
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer(req.body)) {
      try {
        return resolve(req.body.length ? JSON.parse(req.body.toString('utf8')) : {});
      } catch (error) {
        return reject(error);
      }
    }
    let raw = '';
    req.on('data', function (chunk) {
      raw += chunk;
      if (raw.length > 8192) return reject(new Error('BODY_TOO_LARGE'));
    });
    req.on('end', function () {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function scoreAnswers(answers) {
  return Object.keys(CORRECT).reduce(function (score, key) {
    return score + (answers && answers[key] === CORRECT[key] ? 1 : 0);
  }, 0);
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ error: 'METHOD_NOT_ALLOWED' }));
  }

  try {
    const session = readSession(req);
    if (!session) {
      res.statusCode = 401;
      return res.end(JSON.stringify({ error: 'AUTH_REQUIRED' }));
    }

    const body = await readBody(req);
    const answers = body.answers && typeof body.answers === 'object' ? body.answers : {};
    const total = Object.keys(CORRECT).length;
    const score = scoreAnswers(answers);
    const passed = score >= 6;
    const now = new Date().toISOString();

    const admin = getAdminClient();
    const { error } = await admin
      .from('education_progress')
      .upsert({
        user_id: session.sub,
        course: 'volunteer',
        score: score,
        total: total,
        passed: passed,
        answers: answers,
        completed_at: passed ? now : null,
        updated_at: now
      }, { onConflict: 'user_id,course' });

    if (error) throw error;

    if (passed) {
      const { error: userError } = await admin
        .from('users')
        .update({
          education_completed: true,
          education_score: score,
          education_completed_at: now,
          updated_at: now
        })
        .eq('id', session.sub);
      if (userError) throw userError;
    }

    res.statusCode = 200;
    return res.end(JSON.stringify({
      completed: passed,
      score: score,
      total: total,
      completedAt: passed ? now : null
    }));
  } catch (error) {
    res.statusCode = 500;
    return res.end(JSON.stringify({
      error: 'EDUCATION_COMPLETE_FAILED',
      message: process.env.NODE_ENV === 'production' ? undefined : String(error.message || error)
    }));
  }
};
