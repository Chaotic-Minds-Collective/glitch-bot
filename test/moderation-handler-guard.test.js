const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EmbedBuilder } = require('discord.js');

process.env.DISCORD_TOKEN = 'test-token';
process.env.GUILD_ID = 'test-guild';
process.env.CLIENT_ID = 'test-client';
process.env.OWNER_ID = 'test-owner';
process.env.ROLE_STAFF = 'staff-role';
process.env.ROLE_MODERATOR = 'moderator-role';
process.env.CHANNEL_MOD_LOG = 'test-mod-log';

const commands = require('../src/commands/moderation');
const { modLog } = commands.helpers;

/**
 * Create an interaction for an untrusted member and action-tracking targets.
 * @param {string} commandName Moderation command to execute.
 * @returns {{interaction: object, actionCalls: string[], replies: object[]}} Test harness.
 */
function unauthorizedInteraction(commandName) {
  const actionCalls = [];
  const replies = [];
  const target = {
    id: 'target-member',
    user: { username: 'Target' },
    async send() { actionCalls.push('dm'); },
    async timeout() { actionCalls.push('timeout'); },
    async kick() { actionCalls.push('kick'); },
    async ban() { actionCalls.push('ban'); },
  };
  const interaction = {
    user: { id: 'untrusted-user' },
    member: { roles: ['untrusted-role'] },
    options: {
      getMember() { return target; },
      getString() { return 'test reason'; },
      getInteger() { return 5; },
    },
    guild: { name: 'Test Guild' },
    channel: {
      async bulkDelete() { actionCalls.push('purge'); return { size: 0 }; },
    },
    async reply(payload) { replies.push(payload); },
  };
  return { interaction, actionCalls, replies, commandName };
}

test('all moderation execute handlers reject unauthorized invokers before action', async () => {
  for (const name of ['warn', 'timeout', 'kick', 'ban', 'purge']) {
    const command = commands.find((item) => item.data.name === name);
    const { interaction, actionCalls, replies } = unauthorizedInteraction(name);

    await command.execute({}, interaction);

    assert.deepEqual(actionCalls, [], name);
    assert.equal(replies.length, 1, name);
    assert.equal(replies[0].ephemeral, true, name);
    assert.match(replies[0].content, /configured Staff or Moderator role/i, name);
  }
});

test('moderation log fetches the destination even when it is not cached', async () => {
  let fetchedId;
  let sent = 0;
  const guild = {
    channels: {
      async fetch(id) {
        fetchedId = id;
        return { async send(payload) { sent += 1; assert.equal(payload.embeds.length, 1); } };
      },
    },
  };

  const success = await modLog(guild, new EmbedBuilder().setTitle('Test log'));
  assert.equal(success, true);
  assert.equal(fetchedId, 'test-mod-log');
  assert.equal(sent, 1);
});

test('moderation log handles channel fetch and send failures', async () => {
  const errors = [];
  const originalError = console.error;
  console.error = (...args) => errors.push(args);
  try {
    const fetchFailure = await modLog({
      channels: { async fetch() { throw new Error('simulated fetch failure'); } },
    }, new EmbedBuilder().setTitle('Test log'));
    assert.equal(fetchFailure, false);

    const sendFailure = await modLog({
      channels: { async fetch() { return { async send() { throw new Error('simulated send failure'); } }; } },
    }, new EmbedBuilder().setTitle('Test log'));
    assert.equal(sendFailure, false);
    assert.equal(errors.length, 2);
  } finally {
    console.error = originalError;
  }
});
