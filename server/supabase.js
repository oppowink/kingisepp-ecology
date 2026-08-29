const { createClient } = require('@supabase/supabase-js');

function getAdminClient() {
  const url = process.env.SUPABASE_URL;
  // publishable/anon для OTP; для записи в users лучше service role, если задан
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL or key is missing');
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

function getAuthClient() {
  const url = process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL or publishable/anon key is missing');
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

module.exports = { getAdminClient, getAuthClient };
