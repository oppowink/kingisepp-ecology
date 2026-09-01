'use strict';

const { readSession, publicUser } = require('../../../server/session');
const { getAdminClient } = require('../../../server/supabase');
const { toSessionUser } = require('../../../server/users');

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

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ error: 'METHOD_NOT_ALLOWED' }));
  }

  try {
    const session = readSession(req);
    if (!session) {
      res.statusCode = 403;
      return res.end(JSON.stringify({ error: 'ADMIN_REQUIRED' }));
    }

    const admin = getAdminClient();
    const { data: currentUser, error: currentError } = await admin
      .from('users')
      .select('role')
      .eq('id', session.sub)
      .maybeSingle();

    if (currentError) throw currentError;
    if (!currentUser || currentUser.role !== 'admin') {
      res.statusCode = 403;
      return res.end(JSON.stringify({ error: 'ADMIN_REQUIRED' }));
    }

    const body = await readBody(req);
    const email = String(body.email || '').trim().toLowerCase();
    const role = String(body.role || '').trim();

    if (!validEmail(email)) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: 'INVALID_EMAIL' }));
    }
    if (!['participant', 'moderator', 'admin'].includes(role)) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: 'INVALID_ROLE' }));
    }

    const { data: row, error: findError } = await admin
      .from('users')
      .select('*')
      .ilike('email', email)
      .maybeSingle();

    if (findError) throw findError;
    if (!row) {
      res.statusCode = 404;
      return res.end(JSON.stringify({ error: 'USER_NOT_FOUND' }));
    }

    const { data: updated, error: updateError } = await admin
      .from('users')
      .update({ role: role, updated_at: new Date().toISOString() })
      .eq('id', row.id)
      .select('*')
      .single();

    if (updateError) throw updateError;

    res.statusCode = 200;
    return res.end(JSON.stringify({ user: publicUser(toSessionUser(updated)) }));
  } catch (error) {
    res.statusCode = 500;
    return res.end(JSON.stringify({
      error: 'ROLE_UPDATE_FAILED',
      message: process.env.NODE_ENV === 'production' ? undefined : String(error.message || error)
    }));
  }
};
