const { readSession, publicUser } = require('../../server/session');
const { getAdminClient } = require('../../server/supabase');
const { toSessionUser } = require('../../server/users');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ error: 'METHOD_NOT_ALLOWED' }));
  }
  try {
    const session = readSession(req);
    if (!session) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ user: null }));
    }
    try {
      const admin = getAdminClient();
      const { data: row, error } = await admin
        .from('users')
        .select('*')
        .eq('id', session.sub)
        .maybeSingle();

      if (!error && row) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ user: publicUser(toSessionUser(row)) }));
      }
    } catch (_) {}

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ user: publicUser(session) }));
  } catch (err) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'SESSION_ERROR' }));
  }
};
