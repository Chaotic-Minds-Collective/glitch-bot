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

function interactionFor({
  userId = 'staff-user',
  roles = ['staff-role'],
  invokerPosition = 5,
  targetPosition = 2,
  botPosition = 10,
  targetId = 'target-user',
  targetHasHighest = true,
  invokerFetchReject = false,
  targetFetchReject = false,
} = {}) {
  const replies = [];
  const targetHighest = {
    position: targetPosition,
    comparePositionTo(other) { return targetPosition - other.position; },
  };
  const target = { id: targetId, roles: targetHasHighest ? { highest: targetHighest } : [] };
  const invoker = {
    roles: {
      highest: {
        position: invokerPosition,
        comparePositionTo(other) { return invokerPosition - other.position; },
      },
    },
  };
  const botMember = {
    roles: {
      highest: {
        position: botPosition,
        comparePositionTo(other) { return botPosition - other.position; },
      },
    },
  };
  const guildMemberCache = new Map();
  if (invoker.roles.highest) guildMemberCache.set(userId, invoker);
  return {
    replies,
    target,
    user: { id: userId },
    member: { roles },
    guild: {
      ownerId: 'guild-owner',
      members: {
        me: botMember,
        cache: guildMemberCache,
        async fetch(id) {
          if (id === userId) {
            if (invokerFetchReject) throw new Error('simulated invoker fetch failure');
            return invoker;
          }
          if (id === targetId) {
            if (targetFetchReject) throw new Error('simulated target fetch failure');
            return { id: targetId, roles: { highest: targetHighest } };
          }
          throw new Error('unexpected member fetch');
        },
      },
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
  const interaction = interactionFor({ invokerPosition: 10, targetPosition: 9, botPosition: 7 });
  assert.equal(await authorizeMemberAction(interaction, interaction.target), false);
  assert.match(interaction.replies[0].content, /Glitch.*highest role/i);
});

test('member action authorization rejects missing, self, and guild-owner targets', async () => {
  const missing = interactionFor();
  assert.equal(await authorizeMemberAction(missing, null), false);
  assert.match(missing.replies[0].content, /not currently a member/i);

  const self = interactionFor({ targetId: 'staff-user' });
  assert.equal(await authorizeMemberAction(self, self.target), false);
  assert.match(self.replies[0].content, /yourself/i);

  const guildOwnerTarget = interactionFor({ targetId: 'guild-owner' });
  assert.equal(await authorizeMemberAction(guildOwnerTarget, guildOwnerTarget.target), false);
  assert.match(guildOwnerTarget.replies[0].content, /server owner cannot be targeted/i);
});

test('member action authorization fails closed when invoker or target hierarchy cannot be resolved', async () => {
  const invokerFetchFailure = interactionFor({ invokerFetchReject: true });
  assert.equal(await authorizeMemberAction(invokerFetchFailure, invokerFetchFailure.target), false);
  assert.match(invokerFetchFailure.replies[0].content, /unable to verify your role hierarchy/i);

  const targetFetchFailure = interactionFor({ targetHasHighest: false, targetFetchReject: true });
  assert.equal(await authorizeMemberAction(targetFetchFailure, targetFetchFailure.target), false);
  assert.match(targetFetchFailure.replies[0].content, /unable to verify the target member/i);
});

test('guild owner may bypass invoker hierarchy but bot hierarchy remains required', async () => {
  const owner = interactionFor({
    userId: 'guild-owner',
    roles: ['staff-role'],
    invokerPosition: 1,
    targetPosition: 8,
    botPosition: 10,
  });
  assert.equal(await authorizeMemberAction(owner, owner.target), true);
  assert.equal(owner.replies.length, 0);
});

test('timeout and purge slash-command options enforce their supported bounds', () => {
  const timeout = commands.find((command) => command.data.name === 'timeout').data.toJSON();
  const minutes = timeout.options.find((option) => option.name === 'minutes');
  assert.equal(minutes.min_value, 1);
  assert.equal(minutes.max_value, 40320);

  const purgeCommand = commands.find((command) => command.data.name === 'purge').data.toJSON();
  const count = purgeCommand.options.find((option) => option.name === 'count');
  assert.equal(count.min_value, 1);
  assert.equal(count.max_value, 100);

  // Configured Moderator and Support Team roles have ModerateMembers in the live guild.
  // Runtime checks enforce the configured staff-role allowlist; the bot must hold
  // KickMembers, BanMembers, and ManageMessages respectively to perform each action.
  const expectedDefault = timeout.default_member_permissions;
  for (const name of ['warn', 'timeout', 'kick', 'ban', 'purge']) {
    const command = commands.find((item) => item.data.name === name).data.toJSON();
    assert.equal(command.default_member_permissions, expectedDefault, name);
  }
});
