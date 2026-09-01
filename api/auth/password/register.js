'use strict';

const { getAdminClient } = require('../../../server/supabase');
const { sessionCookieValue, publicUser } = require('../../../server/session');
const { upsertUser, toSessionUser } = require('../../../server/users');

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

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isDuplicate(error) {
  const text = String(error && error.message || '').toLowerCase();
  return text.includes('already') || text.includes('registered') || text.includes('exists');
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ error: 'METHOD_NOT_ALLOWED' }));
  }

  try {
    const body = await readBody(req);
    const email = String(body.email || '').trim().toLowerCase();
    const name = String(body.name || '').trim();
    const password = String(body.password || '');

    if (!isEmail(email)) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: 'INVALID_EMAIL' }));
    }
    if (name.length < 2 || name.length > 80) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: 'INVALID_NAME' }));
    }
    if (password.length < 8 || password.length > 128) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: 'WEAK_PASSWORD' }));
    }

    const admin = getAdminClient();
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: { name: name }
    });

    if (createError || !created || !created.user) {
      res.statusCode = isDuplicate(createError) ? 409 : 400;
      return res.end(JSON.stringify({
        error: isDuplicate(createError) ? 'ACCOUNT_EXISTS' : 'REGISTRATION_FAILED'
      }));
    }

    let row;
    try {
      row = await upsertUser(admin, {
        email: email,
        name: name,
        supabaseAuthId: created.user.id,
        provider: 'password'
      });
    } catch (profileError) {
      // Не оставляем «полусозданный» аккаунт, если профиль записать не удалось.
      await admin.auth.admin.deleteUser(created.user.id).catch(function () {});
      throw profileError;
    }
    const user = toSessionUser(row);

    res.setHeader('Set-Cookie', sessionCookieValue(user));
    res.statusCode = 201;
    return res.end(JSON.stringify({ user: publicUser(user) }));
  } catch (error) {
    res.statusCode = 500;
    return res.end(JSON.stringify({
      error: 'REGISTRATION_FAILED',
      message: process.env.NODE_ENV === 'production' ? undefined : String(error.message || error)
    }));
  }
};
