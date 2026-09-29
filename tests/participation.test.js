'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { joinOrganization } = require('../server/participation');
const research = require('../data/research-sites.json');

function membershipClient(existing) {
  const organization = { id: 'org-1', name: 'Школа', join_code: 'JOIN123', status: 'active' };
  const writes = [];
  return {
    writes,
    from(table) {
      const query = {
        select() { return this; },
        eq() { return this; },
        upsert(row) { writes.push(row); return this; },
        async maybeSingle() { return { data: table === 'organizations' ? organization : existing, error: null }; },
        async single() { return { data: writes.at(-1), error: null }; }
      };
      return query;
    }
  };
}

test('global curator cannot obtain curator access through a shared join code', async function () {
  const admin = membershipClient(null);
  const result = await joinOrganization(admin, { id: 'user-1', role: 'curator' }, 'JOIN123');
  assert.equal(result.membership.member_role, 'participant');
  assert.equal(admin.writes.length, 1);
});

test('joining again preserves an active curator membership', async function () {
  const existing = { member_role: 'curator', status: 'active' };
  const admin = membershipClient(existing);
  const result = await joinOrganization(admin, { id: 'user-1', role: 'curator' }, 'JOIN123');
  assert.equal(result.membership, existing);
  assert.equal(admin.writes.length, 0);
});

test('a former curator cannot reactivate curator access through the shared code', async function () {
  const admin = membershipClient({ member_role: 'curator', status: 'left' });
  const result = await joinOrganization(admin, { id: 'user-1', role: 'curator' }, 'JOIN123');
  assert.equal(result.membership.member_role, 'participant');
});

test('published control values match the pilot study table', function () {
  const byId = new Map(research.points.map(point => [point.id, point]));
  assert.equal(byId.get('site-01').fa, 0.026);
  assert.equal(byId.get('site-02').fa, 0.0287);
  assert.ok(research.points.every(point => !/загрязнение/.test(point.level)));
});
