'use strict';

const { readSession } = require('../../server/session');
const { getAdminClient } = require('../../server/supabase');
const { profiles } = require('../../server/users');
const { requests, toClientRequest, toDbInsert } = require('../../server/requests');

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
      res.statusCode = 401;
      return res.end(JSON.stringify({ error: 'AUTH_REQUIRED' }));
    }

    const admin = getAdminClient();
    const { data: currentUser, error: currentError } = await profiles(admin)
      .select('id, email, name, role, education_completed')
      .eq('id', session.sub)
      .maybeSingle();

    if (currentError) throw currentError;
    if (!currentUser) {
      res.statusCode = 401;
      return res.end(JSON.stringify({ error: 'AUTH_REQUIRED' }));
    }
    if (!currentUser.education_completed && !['moderator', 'admin'].includes(currentUser.role)) {
      res.statusCode = 403;
      return res.end(JSON.stringify({ error: 'EDUCATION_REQUIRED' }));
    }

    const body = await readBody(req);
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
  } catch (error) {
    res.statusCode = 500;
    return res.end(JSON.stringify({
      error: 'REQUEST_CREATE_FAILED',
      message: process.env.NODE_ENV === 'production' ? undefined : String(error.message || error)
    }));
  }
};
