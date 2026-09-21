'use strict';
const { readSession } = require('../../server/session');
const { getAdminClient } = require('../../server/supabase');
const { profiles } = require('../../server/users');
const COURSES = new Set(['participant', 'curator', 'moderator']);
function queryParam(req, name) { return new URL(req.url || '/', 'http://localhost').searchParams.get(name) || ''; }
function courseForRole(role) { return role === 'curator' ? 'curator' : role === 'moderator' ? 'moderator' : 'participant'; }
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store'); res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method !== 'GET') { res.statusCode = 405; return res.end(JSON.stringify({ error: 'METHOD_NOT_ALLOWED' })); }
  try {
    const session = readSession(req);
    if (!session) { res.statusCode = 401; return res.end(JSON.stringify({ error: 'AUTH_REQUIRED' })); }
    const admin = getAdminClient();
    const profile = await profiles(admin).select('id,role,blocked').eq('id', session.sub).maybeSingle();
    if (profile.error) throw profile.error;
    if (!profile.data || profile.data.blocked) { res.statusCode = 403; return res.end(JSON.stringify({ error: 'ACCOUNT_BLOCKED' })); }
    const requested = queryParam(req, 'course');
    const course = COURSES.has(requested) ? requested : courseForRole(profile.data.role);
    if (profile.data.role !== 'admin' && course !== courseForRole(profile.data.role)) {
      res.statusCode = 403; return res.end(JSON.stringify({ error: 'COURSE_ROLE_MISMATCH' }));
    }
    const result = await admin.from('education_progress')
      .select('course,score,total,passed,lessons_completed,lessons_completed_at,attempts,completed_at,updated_at')
      .eq('user_id', session.sub).eq('course', course).maybeSingle();
    if (result.error) throw result.error;
    const data = result.data;
    res.statusCode = 200;
    return res.end(JSON.stringify({
      course: course, lessonsCompleted: Boolean(data && data.lessons_completed),
      lessonsCompletedAt: data ? data.lessons_completed_at : null,
      completed: Boolean(data && data.passed), certificateUnlocked: Boolean(data && data.passed),
      score: data ? Number(data.score || 0) : 0, total: data ? Number(data.total || 0) : 0,
      attempts: data ? Number(data.attempts || 0) : 0, completedAt: data ? data.completed_at : null
    }));
  } catch (error) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: 'EDUCATION_STATUS_FAILED', message: process.env.NODE_ENV === 'production' ? undefined : String(error.message || error) }));
  }
};
