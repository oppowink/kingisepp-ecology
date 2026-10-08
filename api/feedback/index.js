'use strict';
const { getAdminClient } = require('../../server/supabase');
const { validateFeedback, reserveFeedback } = require('../../server/feedback');
module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('Cache-Control', 'no-store');
  const origin = req.headers?.origin;
  if (origin && ['https://oppowink.github.io', process.env.APP_URL].includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS'); res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  const send = (status, data) => { res.statusCode = status; return res.end(JSON.stringify(data)); };
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  if (req.method !== 'POST') return send(405, { error: 'METHOD_NOT_ALLOWED' });
  try {
    const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : req.body;
    const body = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!body || typeof body !== 'object') return send(400, { error: 'INVALID_FEEDBACK' });
    const payload = validateFeedback(body);
    const key = String(req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
    if (!reserveFeedback(key)) return send(429, { error: 'RATE_LIMITED' });
    const result = await getAdminClient().from('feedback_messages').insert(payload);
    if (result.error) throw result.error;
    return send(201, { saved: true });
  } catch (error) { return send(error instanceof SyntaxError || error.message === 'INVALID_FEEDBACK' ? 400 : 503, { error: 'FEEDBACK_UNAVAILABLE' }); }
};
