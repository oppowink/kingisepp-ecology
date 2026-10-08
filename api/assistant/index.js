'use strict';
const { configuration, allowRequest, complete } = require('../../server/project-assistant');
async function readBody(req) {
  if (Buffer.isBuffer(req.body)) return JSON.parse(req.body.toString('utf8'));
  if (typeof req.body === 'string') return JSON.parse(req.body);
  if (req.body && typeof req.body === 'object') return req.body;
  let raw = '';
  for await (const chunk of req) { raw += chunk; if (raw.length > 24000) throw new Error('BODY_TOO_LARGE'); }
  return JSON.parse(raw || '{}');
}
module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  const origin = req.headers?.origin;
  const allowedOrigins = ['https://oppowink.github.io', process.env.APP_URL].filter(Boolean);
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  function send(status, data) { res.statusCode = status; return res.end(JSON.stringify(data)); }
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  if (req.method === 'GET') return send(200, { enabled: configuration().enabled, images: false });
  if (req.method !== 'POST') return send(405, { error: 'METHOD_NOT_ALLOWED' });
  try {
    const body = await readBody(req);
    if (typeof body.question !== 'string' || !body.question.trim() || body.question.length > 1500) return send(400, { error: 'QUESTION_REQUIRED' });
    if (body.context && body.consent !== true) return send(400, { error: 'CONTEXT_CONSENT_REQUIRED' });
    const key = String(req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
    if (!allowRequest(key)) return send(429, { error: 'RATE_LIMIT', message: 'Слишком много вопросов подряд. Подождите минуту.' });
    return send(200, await complete(body));
  } catch (error) {
    if (error instanceof SyntaxError || error.message === 'BODY_TOO_LARGE') return send(400, { error: 'INVALID_BODY' });
    return send(503, { error: 'ASSISTANT_UNAVAILABLE', message: 'Сервис ответов временно недоступен. Можно воспользоваться справкой сайта.' });
  }
};
