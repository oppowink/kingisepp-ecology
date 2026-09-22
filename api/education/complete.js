'use strict';
const { readSession } = require('../../server/session');
const { getAdminClient } = require('../../server/supabase');
const { profiles } = require('../../server/users');

const TESTS = {
  participant: { pass: 5, answers: { q1: 'betula', q2: 'two_to_four', q3: 'light_background', q4: 'whole_leaf', q5: 'mark_tree', q6: 'moderation' } },
  curator: { pass: 6, answers: { q1: 'organize', q2: 'join_code', q3: 'territory', q4: 'five_trees', q5: 'moderator_decides', q6: 'progress', q7: 'protect_data' } },
  moderator: { pass: 9, answers: { q1: 'data_quality', q2: 'two_to_four', q3: 'cut_leaf', q4: 'shape_distortion', q5: 'fix_or_reject', q6: 'check_landmarks', q7: 'after_final_review', q8: 'reason', q9: 'duplicate_flag', q10: 'checklist' } }
};
function readBody(req) {
  return new Promise(function (resolve, reject) {
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    if (typeof req.body === 'string') { try { return resolve(req.body ? JSON.parse(req.body) : {}); } catch (error) { return reject(error); } }
    if (Buffer.isBuffer(req.body)) { try { return resolve(req.body.length ? JSON.parse(req.body.toString('utf8')) : {}); } catch (error) { return reject(error); } }
    let raw = ''; req.on('data', function (chunk) { raw += chunk; if (raw.length > 16384) reject(new Error('BODY_TOO_LARGE')); });
    req.on('end', function () { try { resolve(raw ? JSON.parse(raw) : {}); } catch (error) { reject(error); } }); req.on('error', reject);
  });
}
function courseForRole(role) { return role === 'curator' ? 'curator' : role === 'moderator' ? 'moderator' : 'participant'; }
function scoreAnswers(correct, answers) { return Object.keys(correct).reduce(function (score, key) { return score + (answers && answers[key] === correct[key] ? 1 : 0); }, 0); }
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store'); res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method !== 'POST') { res.statusCode = 405; return res.end(JSON.stringify({ error: 'METHOD_NOT_ALLOWED' })); }
  try {
    const session = readSession(req);
    if (!session) { res.statusCode = 401; return res.end(JSON.stringify({ error: 'AUTH_REQUIRED' })); }
    const body = await readBody(req); const admin = getAdminClient();
    const profile = await profiles(admin).select('id,role,blocked').eq('id', session.sub).maybeSingle();
    if (profile.error) throw profile.error;
    if (!profile.data || profile.data.blocked) { res.statusCode = 403; return res.end(JSON.stringify({ error: 'ACCOUNT_BLOCKED' })); }
    const course = TESTS[body.course] ? body.course : courseForRole(profile.data.role);
    if (profile.data.role !== 'admin' && course !== courseForRole(profile.data.role)) { res.statusCode = 403; return res.end(JSON.stringify({ error: 'COURSE_ROLE_MISMATCH' })); }
    const now = new Date().toISOString();
    if (body.stage === 'lessons') {
      const old = await admin.from('education_progress').select('score,total,passed,answers,attempts,completed_at').eq('user_id', session.sub).eq('course', course).maybeSingle();
      if (old.error) throw old.error; const row = old.data || {};
      const saved = await admin.from('education_progress').upsert({ user_id: session.sub, course: course, score: Number(row.score || 0), total: Number(row.total || 0), passed: Boolean(row.passed), answers: row.answers || {}, attempts: Number(row.attempts || 0), lessons_completed: true, lessons_completed_at: now, completed_at: row.completed_at || null, updated_at: now }, { onConflict: 'user_id,course' });
      if (saved.error) throw saved.error;
      res.statusCode = 200; return res.end(JSON.stringify({ course: course, lessonsCompleted: true, completed: Boolean(row.passed) }));
    }
    const progress = await admin.from('education_progress').select('lessons_completed,attempts').eq('user_id', session.sub).eq('course', course).maybeSingle();
    if (progress.error) throw progress.error;
    if (!progress.data || !progress.data.lessons_completed) { res.statusCode = 409; return res.end(JSON.stringify({ error: 'LESSONS_REQUIRED' })); }
    const answers = body.answers && typeof body.answers === 'object' ? body.answers : {}; const test = TESTS[course];
    const total = Object.keys(test.answers).length; const score = scoreAnswers(test.answers, answers); const passed = score >= test.pass; const attempts = Number(progress.data.attempts || 0) + 1;
    const saved = await admin.from('education_progress').upsert({ user_id: session.sub, course: course, score: score, total: total, passed: passed, answers: answers, attempts: attempts, lessons_completed: true, completed_at: passed ? now : null, updated_at: now }, { onConflict: 'user_id,course' });
    if (saved.error) throw saved.error;
    if (course === 'participant' && passed) {
      const update = await profiles(admin).update({ education_completed: true, education_score: score, education_completed_at: now, updated_at: now }).eq('id', session.sub);
      if (update.error) throw update.error;
    }
    res.statusCode = 200;
    return res.end(JSON.stringify({ course: course, lessonsCompleted: true, completed: passed, certificateUnlocked: passed, score: score, total: total, passScore: test.pass, attempts: attempts, completedAt: passed ? now : null }));
  } catch (error) {
    res.statusCode = 500; return res.end(JSON.stringify({ error: 'EDUCATION_COMPLETE_FAILED', message: process.env.NODE_ENV === 'production' ? undefined : String(error.message || error) }));
  }
};
