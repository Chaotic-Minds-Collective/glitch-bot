const { test } = require('node:test');
const assert = require('node:assert/strict');

process.env.DISCORD_TOKEN = 'test-token';
process.env.GUILD_ID = 'test-guild';
process.env.CLIENT_ID = 'test-client';
process.env.OWNER_ID = 'test-owner';
process.env.ROLE_STAFF = 'staff-role';
process.env.ROLE_MODERATOR = 'moderator-role';

const commands = require('../src/commands/moderation');
const { hasStaffAccess, authorizeMemberAction } = commands.helpers;

function roleAt(position) {
  return { comparePositionTo(other) { return position - other.position; }, position };
}

function interactionFor({ userId = 'staff-user', roles = ['staff-role'], invokerPosition = 5, targetPosition = 2, botPosition = 10, targetId = 'target-user' } = {}) {
  const replies = [];
  const target = { id: targetId, roles: { highest: { position: targetPosition, comparePositionTo(other) { return targetPosition - other.position; } } } };
  const invoker = { roles: { highest: { position: invokerPosition, comparePositionTo(other) { return invokerPosition - other.position; } } } };
  const botMember = { roles: { highest: { position: botPosition, comparePositionTo(other) { return botPosition - other.position; } } } };
  return {
    replies,
    target,
    user: { id: userId },
    member: { roles },
    guild: {
      ownerId: 'guild-owner',
      members: { me: botMember, async fetch(id) { assert.equal(id, userId); return invoker; } },
    },
    async reply(payload) { replies.push(payload); },
  };
}

test('configured staff and moderator roles grant moderation access; other roles do not', () => {
  assert.equal(hasStaffAccess(interactionFor({ roles: ['staff-role'] })), true);
  assert.equal(hasStaffAccess(interactionFor({ roles: ['moderator-role'] })), true);
  assert.equal(hasStaffAccess(interactionFor({ roles: ['unrelated-role'] })), false);
  assert.equal(hasStaffAccess(interactionFor({ userId: 'test-owner', roles: [] })), true);
});

test('member action authorization accepts a staff member above the target and bot', async () => {
  const interaction = interactionFor({ invokerPosition: 5, targetPosition: 2, botPosition: 10 });
  assert.equal(await authorizeMemberAction(interaction, interaction.target), true);
  assert.equal(interaction.replies.length, 0);
});

test('member action authorization rejects target at or above invoker hierarchy', async () => {
  const interaction = interactionFor({ invokerPosition: 5, targetPosition: 5, botPosition: 10 });
  assert.equal(await authorizeMemberAction(interaction, interaction.target), false);
  assert.match(interaction.replies[0].content, /highest role must be above/i);
});

test('member action authorization rejects targets above Glitch hierarchy', async () => {
  const interaction = interactionFor({ invokerPosition: 8, targetPosition: 9, botPosition: 7 });
  assert.equal(await authorizeMemberAction(interaction, interaction.target), false);
  assert.match(interaction.replies[0].content, /Glitch.*highest role/i);
});

test('member action authorization rejects missing or self targets', async () => {
  const missing = interactionFor();
  assert.equal(await authorizeMemberAction(missing, null), false);
  assert.match(missing.replies[0].content, /not currently a member/i);

  const self = interactionFor({ targetId: 'staff-user' });
  assert.equal(await authorizeMemberAction(self, self.target), false);
  assert.match(self.replies[0].content, /yourself/i);
});

test('timeout and purge slash-command options enforce their supported bounds', () => {
  const timeout = commands.find((command) => command.data.name === 'timeout').data.toJSON();
  const minutes = timeout.options.find((option) => option.name === 'minutes');
  assert.equal(minutes.min_value, 1);
  assert.equal(minutes.max_value, 40320);

  const purge = commands.find((command) => command.data.name === 'purge').data.toJSON();
  const count = purge.options.find((option) => option.name === 'count');
  assert.equal(count.min_value, 1);
  assert.equal(count.max_value, 100);
});
