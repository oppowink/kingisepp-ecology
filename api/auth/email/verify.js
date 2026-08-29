const { getAuthClient, getAdminClient } = require('../../../server/supabase');
const { sessionCookieValue, publicUser } = require('../../../server/session');

function readBody(req) {
  return new Promise(function (resolve, reject) {
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    let raw = '';
    req.on('data', function (c) { raw += c; });
    req.on('end', function () {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

async function upsertUser(admin, { email, name, supabaseAuthId }) {
  const lower = email.toLowerCase();
  const { data: existing } = await admin
    .from('users')
    .select('*')
    .ilike('email', lower)
    .maybeSingle();

  if (existing) {
    const { data, error } = await admin
      .from('users')
      .update({
        name: name || existing.name,
        supabase_auth_id: supabaseAuthId || existing.supabase_auth_id,
        last_auth_provider: 'email',
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await admin
    .from('users')
    .insert({
      email: lower,
      name: name || null,
      role: 'participant',
      supabase_auth_id: supabaseAuthId || null,
      last_auth_provider: 'email'
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ error: 'METHOD_NOT_ALLOWED' }));
  }
  try {
    const body = await readBody(req);
    const email = String(body.email || '').trim().toLowerCase();
    const token = String(body.token || '').trim();
    const name = String(body.name || '').trim();
    if (!email || !token) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: 'EMAIL_VERIFY_FAILED' }));
    }

    const auth = getAuthClient();
    const { data: otpData, error: otpError } = await auth.auth.verifyOtp({
      email: email,
      token: token,
      type: 'email'
    });
    if (otpError || !otpData) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: 'EMAIL_VERIFY_FAILED', message: otpError && otpError.message }));
    }

    const supabaseUser = otpData.user;
    const admin = getAdminClient();
    const row = await upsertUser(admin, {
      email: email,
      name: name || (supabaseUser && supabaseUser.user_metadata && supabaseUser.user_metadata.name) || '',
      supabaseAuthId: supabaseUser && supabaseUser.id
    });

    const user = {
      id: row.id,
      email: row.email,
      name: row.name || '',
      role: row.role || 'participant'
    };

    res.setHeader('Set-Cookie', sessionCookieValue(user));
    res.statusCode = 200;
    return res.end(JSON.stringify({ user: publicUser(user) }));
  } catch (err) {
    res.statusCode = 500;
    return res.end(JSON.stringify({
      error: 'EMAIL_VERIFY_FAILED',
      message: err.message || 'unknown'
    }));
  }
};
