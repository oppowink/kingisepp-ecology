'use strict';

const { getAdminClient } = require('../../server/supabase');
const { requests, toClientRequest } = require('../../server/requests');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'GET') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ error: 'METHOD_NOT_ALLOWED' }));
  }

  try {
    const admin = getAdminClient();
    const { data, error } = await requests(admin)
      .select('*')
      .eq('status', 'published')
      .order('published_at', { ascending: false });

    if (error) throw error;

    res.statusCode = 200;
    return res.end(JSON.stringify({ requests: (data || []).map(toClientRequest) }));
  } catch (error) {
    res.statusCode = 500;
    return res.end(JSON.stringify({
      error: 'PUBLISHED_REQUESTS_FAILED',
      message: process.env.NODE_ENV === 'production' ? undefined : String(error.message || error)
    }));
  }
};
