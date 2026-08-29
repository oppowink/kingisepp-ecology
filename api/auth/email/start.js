const { getAuthClient } = require('../../../server/supabase');

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
    const name = String(body.name || '').trim();
    if (!email || !email.includes('@')) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: 'EMAIL_REQUIRED' }));
    }

    const supabase = getAuthClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email,
      options: {
        shouldCreateUser: true,
        data: name ? { name: name } : undefined
      }
    });

    if (error) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: 'EMAIL_START_FAILED', message: error.message }));
    }

    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true }));
  } catch (err) {
    res.statusCode = 500;
    return res.end(JSON.stringify({
      error: 'EMAIL_START_FAILED',
      message: err.message || 'unknown'
    }));
  }
};
