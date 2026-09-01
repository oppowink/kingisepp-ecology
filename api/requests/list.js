'use strict';

const { readSession } = require('../../server/session');
const { getAdminClient } = require('../../server/supabase');
const { profiles } = require('../../server/users');
const { requests, toClientRequest } = require('../../server/requests');

function queryParam(req, name) {
  const url = new URL(req.url || '/', 'http://localhost');
  return url.searchParams.get(name) || '';
}

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
    const { data: currentUser, error: currentError } = await profiles(admin)
      .select('id, email, name, role')
      .eq('id', session.sub)
      .maybeSingle();

    if (currentError) throw currentError;
    if (!currentUser) {
      res.statusCode = 401;
      return res.end(JSON.stringify({ error: 'AUTH_REQUIRED' }));
    }

    const scope = queryParam(req, 'scope');
    let query = requests(admin)
      .select('*')
      .order('created_at', { ascending: false });

    if (scope !== 'all' || !['moderator', 'admin'].includes(currentUser.role)) {
      query = query.eq('user_id', session.sub);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.statusCode = 200;
    return res.end(JSON.stringify({
      requests: (data || []).map(toClientRequest)
    }));
  } catch (error) {
    res.statusCode = 500;
    return res.end(JSON.stringify({
      error: 'REQUESTS_LIST_FAILED',
      message: process.env.NODE_ENV === 'production' ? undefined : String(error.message || error)
    }));
  }
};
