// Подпись и разбор cookie-сессии (Vercel serverless)
const crypto = require('crypto');

const COOKIE_NAME = 'eco_session';
const MAX_AGE_SEC = 60 * 60 * 24 * 14; // 14 дней

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error('SESSION_SECRET is missing or too short');
  }
  return s;
}

function b64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function fromB64url(str) {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  const s = str.replace(/-/g, '+').replace(/_/g, '/') + pad;
  return Buffer.from(s, 'base64').toString('utf8');
}

function sign(payloadObj) {
  const payload = b64url(JSON.stringify(payloadObj));
  const sig = crypto
    .createHmac('sha256', secret())
    .update(payload)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return payload + '.' + sig;
}

function verify(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  const expected = crypto
    .createHmac('sha256', secret())
    .update(payload)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(fromB64url(payload));
    if (!data || !data.exp || Date.now() > data.exp) return null;
    return data;
  } catch (_) {
    return null;
  }
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  header.split(';').forEach(function (part) {
    const i = part.indexOf('=');
    if (i === -1) return;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    out[k] = decodeURIComponent(v);
  });
  return out;
}

function readSession(req) {
  const cookies = parseCookies(req);
  return verify(cookies[COOKIE_NAME]);
}

function sessionCookieValue(user) {
  const token = sign({
    sub: user.id,
    email: user.email,
    name: user.name || '',
    role: user.role || 'participant',
    blocked: Boolean(user.blocked),
    educationCompleted: Boolean(user.educationCompleted),
    exp: Date.now() + MAX_AGE_SEC * 1000
  });
  const secure = process.env.NODE_ENV === 'production' || (process.env.APP_URL || '').startsWith('https');
  const parts = [
    COOKIE_NAME + '=' + encodeURIComponent(token),
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=' + MAX_AGE_SEC
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

function clearSessionCookie() {
  const secure = process.env.NODE_ENV === 'production' || (process.env.APP_URL || '').startsWith('https');
  const parts = [
    COOKIE_NAME + '=',
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0'
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

function publicUser(sessionOrRow) {
  if (!sessionOrRow) return null;
  return {
    id: sessionOrRow.sub || sessionOrRow.id,
    email: sessionOrRow.email,
    name: sessionOrRow.name || '',
    role: sessionOrRow.role || 'participant',
    city: sessionOrRow.city || '',
    blocked: Boolean(sessionOrRow.blocked),
    educationCompleted: Boolean(sessionOrRow.educationCompleted || sessionOrRow.education_completed),
    educationScore: Number(sessionOrRow.educationScore || sessionOrRow.education_score || 0),
    educationCompletedAt: sessionOrRow.educationCompletedAt || sessionOrRow.education_completed_at || null
  };
}

module.exports = {
  COOKIE_NAME,
  readSession,
  sessionCookieValue,
  clearSessionCookie,
  publicUser
};
