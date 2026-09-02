'use strict';

const { getAuthClient, getAdminClient } = require('../../../server/supabase');
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
    const password = String(body.password || '');

    if (!email || !password) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: 'CREDENTIALS_REQUIRED' }));
    }

    const auth = getAuthClient();
    const { data: login, error: loginError } = await auth.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (loginError || !login || !login.user) {
      res.statusCode = 401;
      return res.end(JSON.stringify({ error: 'INVALID_CREDENTIALS' }));
    }

    const admin = getAdminClient();
    const metadata = login.user.user_metadata || {};
    const row = await upsertUser(admin, {
      email: login.user.email || email,
      name: metadata.name || '',
      supabaseAuthId: login.user.id,
      provider: 'password'
    });
    if (row.blocked) {
      res.statusCode = 403;
      return res.end(JSON.stringify({ error: 'ACCOUNT_BLOCKED' }));
    }
    const user = toSessionUser(row);

    res.setHeader('Set-Cookie', sessionCookieValue(user));
    res.statusCode = 200;
    return res.end(JSON.stringify({ user: publicUser(user) }));
  } catch (error) {
    res.statusCode = 500;
    return res.end(JSON.stringify({
      error: 'LOGIN_FAILED',
      message: process.env.NODE_ENV === 'production' ? undefined : String(error.message || error)
    }));
  }
};
