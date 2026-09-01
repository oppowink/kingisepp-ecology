'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

process.env.SESSION_SECRET = 'test-session-secret-at-least-32-characters';
process.env.NODE_ENV = 'test';

function response() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    end(value) { this.body = value || ''; }
  };
}

function adminClient(options) {
  options = options || {};
  let row = options.row || null;

  function builder() {
    let operation = 'select';
    let payload = null;
    const chain = {
      select() { return chain; },
      eq() { return chain; },
      ilike() { return chain; },
      update(value) { operation = 'update'; payload = value; return chain; },
      insert(value) { operation = 'insert'; payload = value; return chain; },
      async maybeSingle() { return { data: row, error: null }; },
      async single() {
        if (operation === 'insert') {
          row = Object.assign({ id: 'profile-1', created_at: new Date().toISOString() }, payload);
        } else if (operation === 'update') {
          row = Object.assign({}, row, payload);
        }
        return { data: row, error: null };
      }
    };
    return chain;
  }

  return {
    auth: {
      admin: {
        async createUser() {
          if (options.createError) return { data: null, error: new Error(options.createError) };
          return { data: { user: { id: 'auth-1' } }, error: null };
        }
      }
    },
    from() { return builder(); }
  };
}

function loadHandler(relativePath, clients) {
  const supabasePath = require.resolve('../server/supabase');
  require.cache[supabasePath] = {
    id: supabasePath,
    filename: supabasePath,
    loaded: true,
    exports: clients
  };
  const handlerPath = require.resolve(relativePath);
  delete require.cache[handlerPath];
  return require(relativePath);
}

test('registration validates input before calling Supabase', async function () {
  const handler = loadHandler('../api/auth/password/register', {
    getAdminClient() { throw new Error('must not be called'); }
  });
  const res = response();
  await handler({ method: 'POST', body: { email: 'bad', name: 'П', password: '123' } }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(JSON.parse(res.body).error, 'INVALID_EMAIL');
});

test('registration creates a confirmed account and session cookie', async function () {
  const admin = adminClient();
  const handler = loadHandler('../api/auth/password/register', {
    getAdminClient() { return admin; }
  });
  const res = response();
  await handler({
    method: 'POST',
    body: { email: 'User@Example.com', name: 'Полина', password: 'strong-pass-123' }
  }, res);
  assert.equal(res.statusCode, 201);
  assert.match(res.headers['set-cookie'], /^eco_session=/);
  assert.equal(JSON.parse(res.body).user.email, 'user@example.com');
});

test('registration reports an existing account', async function () {
  const handler = loadHandler('../api/auth/password/register', {
    getAdminClient() { return adminClient({ createError: 'User already registered' }); }
  });
  const res = response();
  await handler({
    method: 'POST',
    body: { email: 'user@example.com', name: 'Полина', password: 'strong-pass-123' }
  }, res);
  assert.equal(res.statusCode, 409);
  assert.equal(JSON.parse(res.body).error, 'ACCOUNT_EXISTS');
});

test('login creates a session for valid Supabase credentials', async function () {
  const admin = adminClient({
    row: {
      id: 'profile-1',
      email: 'user@example.com',
      name: 'Полина',
      role: 'participant',
      supabase_auth_id: 'auth-1'
    }
  });
  const auth = {
    auth: {
      async signInWithPassword() {
        return {
          data: {
            user: {
              id: 'auth-1',
              email: 'user@example.com',
              user_metadata: { name: 'Полина' }
            }
          },
          error: null
        };
      }
    }
  };
  const handler = loadHandler('../api/auth/password/login', {
    getAuthClient() { return auth; },
    getAdminClient() { return admin; }
  });
  const res = response();
  await handler({
    method: 'POST',
    body: { email: 'user@example.com', password: 'strong-pass-123' }
  }, res);
  assert.equal(res.statusCode, 200);
  assert.match(res.headers['set-cookie'], /^eco_session=/);
  assert.equal(JSON.parse(res.body).user.name, 'Полина');
});

test('login rejects invalid credentials without revealing details', async function () {
  const auth = {
    auth: {
      async signInWithPassword() {
        return { data: null, error: new Error('Invalid login credentials') };
      }
    }
  };
  const handler = loadHandler('../api/auth/password/login', {
    getAuthClient() { return auth; },
    getAdminClient() { throw new Error('must not be called'); }
  });
  const res = response();
  await handler({
    method: 'POST',
    body: { email: 'user@example.com', password: 'wrong-password' }
  }, res);
  assert.equal(res.statusCode, 401);
  assert.equal(JSON.parse(res.body).error, 'INVALID_CREDENTIALS');
});
