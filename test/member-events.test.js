const { test } = require('node:test');
const assert = require('node:assert/strict');

process.env.DISCORD_TOKEN = 'test-token';
process.env.GUILD_ID = 'test-guild';
process.env.CLIENT_ID = 'test-client';
process.env.OWNER_ID = 'test-owner';
process.env.CHANNEL_LEAVE_LOG = 'test-leave-log';

const leaveEvent = require('../src/events/guildMemberRemove');

test('leave logger fetches the configured channel and handles send failure', async () => {
  const errors = [];
  const originalError = console.error;
  console.error = (...args) => errors.push(args);
  try {
    let fetchedId;
    const member = {
      user: { username: 'TestUser' },
      guild: {
        channels: {
          async fetch(id) {
            fetchedId = id;
            return {
              isTextBased: () => true,
              async send() { throw new Error('simulated Discord send failure'); },
            };
          },
        },
      },
    };

    await leaveEvent.execute({}, member);
    assert.equal(fetchedId, 'test-leave-log');
    assert.equal(errors.length, 1);
    assert.match(errors[0][0], /Could not post leave log/);
  } finally {
    console.error = originalError;
  }
});

test('leave logger safely handles an unavailable destination', async () => {
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args);
  try {
    const member = {
      user: { username: 'TestUser' },
      guild: {
        channels: {
          async fetch() { throw new Error('simulated missing channel'); },
        },
      },
    };

    await leaveEvent.execute({}, member);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0][0], /missing or is not a text channel/);
  } finally {
    console.warn = originalWarn;
  }
});
