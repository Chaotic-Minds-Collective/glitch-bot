const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ChannelType, PermissionFlagsBits } = require('discord.js');

process.env.DISCORD_TOKEN = 'test-token';
process.env.GUILD_ID = 'test-guild';
process.env.CLIENT_ID = 'test-client';
process.env.OWNER_ID = 'test-owner';
process.env.CHANNEL_TICKETS = 'ticket-category';
process.env.ROLE_STAFF = 'staff-role';
process.env.ROLE_MODERATOR = 'moderator-role';

const {
  handleTicket,
  acquireTicketCreationLock,
  releaseTicketCreationLock,
  buildTicketPermissionOverwrites,
  findExistingTicket,
} = require('../src/features/tickets');
const { canCloseTicket, isTicketChannel } = require('../src/security/permissions');

const ownerId = '123456789012345678';

/**
 * Create a minimal Discord text-channel fixture for ticket permission tests.
 * @param {object} overrides Properties that override the default channel.
 * @returns {object} Fake Discord text channel.
 */
function ticketChannel(overrides = {}) {
  return {
    id: 'ticket-channel',
    type: ChannelType.GuildText,
    parentId: 'ticket-category',
    topic: `ticket-owner:${ownerId}`,
    ...overrides,
  };
}

test('ticket creation lock prevents concurrent duplicate submissions and releases', () => {
  assert.equal(acquireTicketCreationLock('guild-1', ownerId), true);
  assert.equal(acquireTicketCreationLock('guild-1', ownerId), false);
  assert.equal(acquireTicketCreationLock('guild-2', ownerId), true);

  releaseTicketCreationLock('guild-1', ownerId);
  assert.equal(acquireTicketCreationLock('guild-1', ownerId), true);

  releaseTicketCreationLock('guild-1', ownerId);
  releaseTicketCreationLock('guild-2', ownerId);
});

test('ticket overwrites explicitly allow the bot to view and post embeds', () => {
  const overwrites = buildTicketPermissionOverwrites(
    { roles: { everyone: { id: 'everyone' } } },
    ownerId,
    'bot-user'
  );
  const everyone = overwrites.find((entry) => entry.id === 'everyone');
  const bot = overwrites.find((entry) => entry.id === 'bot-user');
  const requester = overwrites.find((entry) => entry.id === ownerId);

  assert.deepEqual(everyone.deny, [PermissionFlagsBits.ViewChannel]);
  assert.ok(bot.allow.includes(PermissionFlagsBits.ViewChannel));
  assert.ok(bot.allow.includes(PermissionFlagsBits.SendMessages));
  assert.ok(bot.allow.includes(PermissionFlagsBits.EmbedLinks));
  assert.ok(requester.allow.includes(PermissionFlagsBits.AttachFiles));
});

test('ticket lookup ignores channels outside the configured ticket category', async () => {
  const valid = ticketChannel();
  const misplaced = ticketChannel({ id: 'unrelated', parentId: 'other-category' });
  const guild = {
    channels: {
      async fetch() {
        return [misplaced, valid];
      },
    },
  };

  assert.equal(await findExistingTicket(guild, ownerId), valid);
});

test('ticket close authorization rejects forged markers outside the ticket area', () => {
  const interaction = { user: { id: ownerId }, member: {} };
  assert.equal(isTicketChannel(ticketChannel()), true);
  assert.equal(canCloseTicket(interaction, ticketChannel()), true);
  assert.equal(canCloseTicket(interaction, ticketChannel({ parentId: 'other-category' })), false);
  assert.equal(canCloseTicket(interaction, ticketChannel({ type: ChannelType.GuildVoice })), false);
});

test('ticket close authorization still permits configured staff in a valid ticket', () => {
  const interaction = {
    user: { id: '223456789012345678' },
    member: { roles: { cache: new Map([['staff-role', {}]]) } },
  };
  assert.equal(canCloseTicket(interaction, ticketChannel()), true);
});

test('failed initial ticket message triggers cleanup of the newly created channel', async () => {
  const errors = [];
  const originalError = console.error;
  console.error = (...args) => errors.push(args);
  let deleted = false;
  let sent = false;
  let reply;
  const channel = {
    id: 'created-ticket',
    async send() {
      sent = true;
      throw new Error('simulated send failure');
    },
    async delete() {
      deleted = true;
    },
    toString() {
      return '<#created-ticket>';
    },
  };
  const guild = {
    id: 'guild-cleanup',
    roles: { everyone: { id: 'everyone' } },
    members: { me: { permissions: { has: (permission) => permission === PermissionFlagsBits.ManageChannels } } },
    channels: {
      async fetch() { return []; },
      async create() { return channel; },
    },
  };
  const interaction = {
    guild,
    user: { id: '323456789012345678', username: 'Test User', tag: 'Test User#0001' },
    client: { user: { id: 'bot-user' } },
    customId: 'ticket_reason',
    inGuild: () => true,
    isButton: () => false,
    isModalSubmit: () => true,
    fields: { getTextInputValue: () => 'Need help' },
    async reply(payload) { reply = payload; },
    deferred: false,
    replied: false,
  };

  try {
    await handleTicket(interaction);
    assert.equal(sent, true);
    assert.equal(deleted, true);
    assert.match(reply.content, /could not finish creating/i);
    assert.equal(acquireTicketCreationLock(guild.id, interaction.user.id), true);
    releaseTicketCreationLock(guild.id, interaction.user.id);
  } finally {
    console.error = originalError;
  }
});
