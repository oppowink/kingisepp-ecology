'use strict';

const { readSession } = require('../../server/session');
const { getAdminClient } = require('../../server/supabase');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'GET') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ error: 'METHOD_NOT_ALLOWED' }));
  }

  try {
    const session = readSession(req);
    if (!session) {
      res.statusCode = 401;
      return res.end(JSON.stringify({ error: 'AUTH_REQUIRED' }));
    }

    const admin = getAdminClient();
    const { data, error } = await admin
      .from('education_progress')
      .select('course, score, total, passed, completed_at, updated_at')
      .eq('user_id', session.sub)
      .eq('course', 'volunteer')
      .maybeSingle();

    if (error) throw error;

    res.statusCode = 200;
    return res.end(JSON.stringify({
      course: 'volunteer',
      completed: Boolean(data && data.passed),
      score: data ? Number(data.score || 0) : 0,
      total: data ? Number(data.total || 0) : 0,
      completedAt: data ? data.completed_at : null
    }));
  } catch (error) {
    res.statusCode = 500;
    return res.end(JSON.stringify({
      error: 'EDUCATION_STATUS_FAILED',
      message: process.env.NODE_ENV === 'production' ? undefined : String(error.message || error)
    }));
  }
};
