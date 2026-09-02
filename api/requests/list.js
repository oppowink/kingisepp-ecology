'use strict';

const { readSession } = require('../../server/session');
const { getAdminClient } = require('../../server/supabase');
const { profiles } = require('../../server/users');
const { requests, toClientRequest, toDbInsert, toDbUpdate } = require('../../server/requests');

const STATUSES = new Set(['pending_human', 'human_approved', 'published', 'rejected']);
const HUMAN_STATUSES = new Set(['pending', 'approved', 'rejected']);
const AI_STATUSES = new Set(['pending', 'checked', 'skipped']);

function queryParam(req, name) {
  const url = new URL(req.url || '/', 'http://localhost');
  return url.searchParams.get(name) || '';
}

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
      if (raw.length > 256000) return reject(new Error('BODY_TOO_LARGE'));
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

function validCoordinates(value) {
  const parts = String(value || '').split(',').map(function (part) { return part.trim(); });
  if (parts.length !== 2) return false;
  const latitude = Number(parts[0]);
  const longitude = Number(parts[1]);
  return Number.isFinite(latitude) && Number.isFinite(longitude) &&
    latitude >= -90 && latitude <= 90 &&
    longitude >= -180 && longitude <= 180;
}

function cleanFileList(files) {
  if (!Array.isArray(files)) return [];
  return files.slice(0, 30).map(function (file) {
    return {
      name: String(file.name || '').slice(0, 180),
      size: Number(file.size || 0),
      type: String(file.type || '').slice(0, 80),
      bgLight: file.bgLight === true ? true : file.bgLight === false ? false : null
    };
  });
}

function validPatch(patch) {
  if (!patch || typeof patch !== 'object') return false;
  if (patch.status && !STATUSES.has(patch.status)) return false;
  if (patch.humanStatus && !HUMAN_STATUSES.has(patch.humanStatus)) return false;
  if (patch.aiStatus && !AI_STATUSES.has(patch.aiStatus)) return false;
  return true;
}

async function currentProfile(admin, session, fields) {
  const { data, error } = await profiles(admin)
    .select(fields || 'id, email, name, role')
    .eq('id', session.sub)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function handleList(req, res, admin) {
  const scope = queryParam(req, 'scope');

  if (scope === 'published') {
    const { data, error } = await requests(admin)
      .select('*')
      .eq('status', 'published')
      .order('published_at', { ascending: false });
    if (error) throw error;
    res.statusCode = 200;
    return res.end(JSON.stringify({ requests: (data || []).map(toClientRequest) }));
  }

  const session = readSession(req);
  if (!session) {
    res.statusCode = 401;
    return res.end(JSON.stringify({ error: 'AUTH_REQUIRED' }));
  }

  const currentUser = await currentProfile(admin, session, 'id, email, name, role, blocked');
  if (!currentUser) {
    res.statusCode = 401;
    return res.end(JSON.stringify({ error: 'AUTH_REQUIRED' }));
  }
  if (currentUser.blocked) {
    res.statusCode = 403;
    return res.end(JSON.stringify({ error: 'ACCOUNT_BLOCKED' }));
  }

  let query = requests(admin)
    .select('*')
    .order('created_at', { ascending: false });

  if (scope !== 'all' || !['moderator', 'admin'].includes(currentUser.role)) {
    query = query.eq('user_id', session.sub);
  }

  const { data, error } = await query;
  if (error) throw error;

  res.statusCode = 200;
  return res.end(JSON.stringify({ requests: (data || []).map(toClientRequest) }));
}

async function handleCreate(req, res, admin, body) {
  const session = readSession(req);
  if (!session) {
    res.statusCode = 401;
    return res.end(JSON.stringify({ error: 'AUTH_REQUIRED' }));
  }

  const currentUser = await currentProfile(admin, session, 'id, email, name, role, blocked, education_completed');
  if (!currentUser) {
    res.statusCode = 401;
    return res.end(JSON.stringify({ error: 'AUTH_REQUIRED' }));
  }
  if (currentUser.blocked) {
    res.statusCode = 403;
    return res.end(JSON.stringify({ error: 'ACCOUNT_BLOCKED' }));
  }
  if (!currentUser.education_completed && !['moderator', 'admin'].includes(currentUser.role)) {
    res.statusCode = 403;
    return res.end(JSON.stringify({ error: 'EDUCATION_REQUIRED' }));
  }

  const files = cleanFileList(body.files);
  const payload = {
    id: 'ECO-' + new Date().getFullYear() + '-' + String(Date.now()).slice(-7),
    title: String(body.title || '').trim(),
    location: String(body.location || '').trim(),
    coordinates: String(body.coordinates || '').trim(),
    collectionDate: String(body.collectionDate || '').trim(),
    comment: String(body.comment || '').trim(),
    files: files,
    treeCount: Number(body.treeCount || 1),
    leafCount: Number(body.leafCount || files.length || 30),
    backgroundFlags: Array.isArray(body.backgroundFlags) ? body.backgroundFlags.slice(0, 30) : [],
    aiResult: body.aiResult || null
  };

  if (!payload.title || !payload.location || !payload.coordinates || !payload.collectionDate) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: 'REQUIRED_FIELDS_MISSING' }));
  }
  if (!validCoordinates(payload.coordinates)) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: 'INVALID_COORDINATES' }));
  }
  if (files.length !== 30) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: 'PHOTO_COUNT_REQUIRED' }));
  }

  const { data, error } = await requests(admin)
    .insert(toDbInsert(payload, currentUser))
    .select('*')
    .single();
  if (error) throw error;

  res.statusCode = 201;
  return res.end(JSON.stringify({ request: toClientRequest(data) }));
}

async function handleModerate(req, res, admin, body) {
  const session = readSession(req);
  if (!session) {
    res.statusCode = 403;
    return res.end(JSON.stringify({ error: 'MODERATOR_REQUIRED' }));
  }

  const currentUser = await currentProfile(admin, session, 'role, blocked');
  if (!currentUser || currentUser.blocked || !['moderator', 'admin'].includes(currentUser.role)) {
    res.statusCode = 403;
    return res.end(JSON.stringify({ error: 'MODERATOR_REQUIRED' }));
  }

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
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (!['GET', 'POST'].includes(req.method)) {
    res.statusCode = 405;
    return res.end(JSON.stringify({ error: 'METHOD_NOT_ALLOWED' }));
  }

  try {
    const admin = getAdminClient();
    if (req.method === 'GET') return handleList(req, res, admin);

    const body = await readBody(req);
    if (body.action === 'create') return handleCreate(req, res, admin, body);
    if (body.action === 'moderate') return handleModerate(req, res, admin, body);

    res.statusCode = 400;
    return res.end(JSON.stringify({ error: 'UNKNOWN_REQUEST_ACTION' }));
  } catch (error) {
    res.statusCode = 500;
    return res.end(JSON.stringify({
      error: 'REQUESTS_API_FAILED',
      message: process.env.NODE_ENV === 'production' ? undefined : String(error.message || error)
    }));
  }
};
