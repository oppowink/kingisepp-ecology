'use strict';

const { readSession } = require('../../server/session');
const { getAdminClient } = require('../../server/supabase');
const { profiles } = require('../../server/users');
const { requests, toClientRequest, toDbUpdate } = require('../../server/requests');

const STATUSES = new Set(['pending_human', 'human_approved', 'published', 'rejected']);
const HUMAN_STATUSES = new Set(['pending', 'approved', 'rejected']);
const AI_STATUSES = new Set(['pending', 'checked', 'skipped']);

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
      if (raw.length > 65536) return reject(new Error('BODY_TOO_LARGE'));
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

function validPatch(patch) {
  if (!patch || typeof patch !== 'object') return false;
  if (patch.status && !STATUSES.has(patch.status)) return false;
  if (patch.humanStatus && !HUMAN_STATUSES.has(patch.humanStatus)) return false;
  if (patch.aiStatus && !AI_STATUSES.has(patch.aiStatus)) return false;
  return true;
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
      return res.end(JSON.stringify({ error: 'MODERATOR_REQUIRED' }));
    }

    const admin = getAdminClient();
    const { data: currentUser, error: currentError } = await profiles(admin)
      .select('role')
      .eq('id', session.sub)
      .maybeSingle();

    if (currentError) throw currentError;
    if (!currentUser || !['moderator', 'admin'].includes(currentUser.role)) {
      res.statusCode = 403;
      return res.end(JSON.stringify({ error: 'MODERATOR_REQUIRED' }));
    }

    const body = await readBody(req);
    const id = String(body.id || '').trim();
    const patch = body.patch && typeof body.patch === 'object' ? body.patch : {};

    if (!id) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: 'REQUEST_ID_REQUIRED' }));
    }
    if (!validPatch(patch)) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: 'INVALID_MODERATION_PATCH' }));
    }

    const { data, error } = await requests(admin)
      .update(toDbUpdate(patch))
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;

    res.statusCode = 200;
    return res.end(JSON.stringify({ request: toClientRequest(data) }));
  } catch (error) {
    res.statusCode = 500;
    return res.end(JSON.stringify({
      error: 'REQUEST_MODERATION_FAILED',
      message: process.env.NODE_ENV === 'production' ? undefined : String(error.message || error)
    }));
  }
};
