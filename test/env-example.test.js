const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const envExample = fs.readFileSync(path.join(__dirname, '../.env.example'), 'utf8');
const values = Object.fromEntries(
  envExample.split(/\r?\n/).map((line) => line.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean).map(([, key, value]) => [key, value]),
);

test('join and leave logs use the valid staff-only moderation log destination', () => {
  assert.ok(values.CHANNEL_MOD_LOG);
  assert.equal(values.CHANNEL_JOIN_LOG, values.CHANNEL_MOD_LOG);
  assert.equal(values.CHANNEL_LEAVE_LOG, values.CHANNEL_MOD_LOG);
});
