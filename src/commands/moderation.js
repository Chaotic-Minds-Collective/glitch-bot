const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const config = require('../config');

const MAX_TIMEOUT_MINUTES = 28 * 24 * 60;

function roleIdsFor(member) {
  if (Array.isArray(member?.roles)) return member.roles;
  if (member?.roles?.cache) return [...member.roles.cache.keys()];
  return [];
}

function hasStaffAccess(interaction) {
  if (config.ownerId && interaction.user.id === config.ownerId) return true;
  const allowedRoles = [config.roles.staff, config.roles.moderator].filter(Boolean);
  return roleIdsFor(interaction.member).some((roleId) => allowedRoles.includes(roleId));
}

async function reject(interaction, content) {
  await interaction.reply({ content, ephemeral: true });
  return false;
}

/**
 * Require configured staff access and protect Discord role hierarchy for
 * member-targeted actions. Platform permission defaults remain an additional gate.
 */
async function authorizeMemberAction(interaction, target) {
  if (!hasStaffAccess(interaction)) {
    return reject(interaction, 'You need the configured Staff or Moderator role to use this command.');
  }
  if (!target) return reject(interaction, 'That user is not currently a member of this server.');
  if (target.id === interaction.user.id) return reject(interaction, 'You cannot use this command on yourself.');
  if (target.id === interaction.guild.ownerId) return reject(interaction, 'The server owner cannot be targeted by this command.');

  const invoker = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
  const botMember = interaction.guild.members.me;
  const isGuildOwner = interaction.user.id === interaction.guild.ownerId;
  if (!isGuildOwner && invoker?.roles?.highest && target.roles?.highest
      && invoker.roles.highest.comparePositionTo(target.roles.highest) <= 0) {
    return reject(interaction, 'Your highest role must be above the target member’s highest role.');
  }
  if (botMember?.roles?.highest && target.roles?.highest
      && botMember.roles.highest.comparePositionTo(target.roles.highest) <= 0) {
    return reject(interaction, 'Glitch’s highest role must be above the target member’s highest role.');
  }
  return true;
}

async function authorizeStaffAction(interaction) {
  if (!hasStaffAccess(interaction)) {
    return reject(interaction, 'You need the configured Staff or Moderator role to use this command.');
  }
  return true;
}

/**
 * Send a moderation embed to the configured mod-log channel.
 * Resolves to false if the destination is missing or the send fails.
 */
async function modLog(guild, embed) {
  if (!config.channels.modLog) return false;
  const ch = guild.channels.cache.get(config.channels.modLog);
  if (!ch || typeof ch.send !== 'function') return false;
  try {
    await ch.send({ embeds: [embed] });
    return true;
  } catch (error) {
    console.error('[Moderation Log Error]', error);
    return false;
  }
}

function logStatus(success) {
  return success ? 'Logged.' : 'Warning: the moderation log could not be delivered.';
}

const moderationCommands = [
  {
    data: new SlashCommandBuilder()
      .setName('warn')
      .setDescription('Warn a member')
      .addUserOption((o) => o.setName('member').setDescription('Member to warn').setRequired(true))
      .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    /** Handle /warn: DM the member and log the warning. */
    async execute(client, interaction) {
      const member = interaction.options.getMember('member');
      if (!await authorizeMemberAction(interaction, member)) return;
      const reason = interaction.options.getString('reason');
      try { await member.send(`You were warned in **${interaction.guild.name}**: ${reason}`); } catch {}
      const embed = new EmbedBuilder().setColor(config.colors.danger)
        .setTitle('Warning issued').setDescription(`${member} was warned by ${interaction.user}\n**Reason:** ${reason}`).setTimestamp();
      const logged = await modLog(interaction.guild, embed);
      await interaction.reply({ content: `Warned ${member.user.username}. ${logStatus(logged)}`, ephemeral: true });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName('timeout')
      .setDescription('Timeout a member')
      .addUserOption((o) => o.setName('member').setDescription('Member').setRequired(true))
      .addIntegerOption((o) => o.setName('minutes').setDescription('Duration in minutes').setRequired(true).setMinValue(1).setMaxValue(MAX_TIMEOUT_MINUTES))
      .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    /** Handle /timeout: apply a native Discord timeout and log it. */
    async execute(client, interaction) {
      const member = interaction.options.getMember('member');
      if (!await authorizeMemberAction(interaction, member)) return;
      const minutes = interaction.options.getInteger('minutes');
      if (!Number.isInteger(minutes) || minutes < 1 || minutes > MAX_TIMEOUT_MINUTES) {
        return reject(interaction, `Timeout duration must be between 1 and ${MAX_TIMEOUT_MINUTES} minutes (28 days).`);
      }
      const reason = interaction.options.getString('reason');
      await member.timeout(minutes * 60 * 1000, reason);
      const embed = new EmbedBuilder().setColor(config.colors.danger)
        .setTitle('Timeout issued').setDescription(`${member} timed out ${minutes}m by ${interaction.user}\n**Reason:** ${reason}`).setTimestamp();
      const logged = await modLog(interaction.guild, embed);
      await interaction.reply({ content: `Timed out ${member.user.username} for ${minutes} minutes. ${logStatus(logged)}`, ephemeral: true });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName('kick')
      .setDescription('Kick a member')
      .addUserOption((o) => o.setName('member').setDescription('Member').setRequired(true))
      .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    /** Handle /kick: remove the member from the guild and log it. */
    async execute(client, interaction) {
      const member = interaction.options.getMember('member');
      if (!await authorizeMemberAction(interaction, member)) return;
      const reason = interaction.options.getString('reason');
      await member.kick(reason);
      const embed = new EmbedBuilder().setColor(config.colors.danger)
        .setTitle('Kick').setDescription(`${member} kicked by ${interaction.user}\n**Reason:** ${reason}`).setTimestamp();
      const logged = await modLog(interaction.guild, embed);
      await interaction.reply({ content: `Kicked ${member.user.username}. ${logStatus(logged)}`, ephemeral: true });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName('ban')
      .setDescription('Ban a member')
      .addUserOption((o) => o.setName('member').setDescription('Member').setRequired(true))
      .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    /** Handle /ban: ban the member from the guild and log it. */
    async execute(client, interaction) {
      const member = interaction.options.getMember('member');
      if (!await authorizeMemberAction(interaction, member)) return;
      const reason = interaction.options.getString('reason');
      await member.ban({ reason });
      const embed = new EmbedBuilder().setColor(config.colors.danger)
        .setTitle('Ban').setDescription(`${member} banned by ${interaction.user}\n**Reason:** ${reason}`).setTimestamp();
      const logged = await modLog(interaction.guild, embed);
      await interaction.reply({ content: `Banned ${member.user.username}. ${logStatus(logged)}`, ephemeral: true });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName('purge')
      .setDescription('Bulk delete messages in this channel')
      .addIntegerOption((o) => o.setName('count').setDescription('1-100').setRequired(true).setMinValue(1).setMaxValue(100))
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    /** Handle /purge: bulk-delete recent messages in the current channel and log the result. */
    async execute(client, interaction) {
      if (!await authorizeStaffAction(interaction)) return;
      const count = interaction.options.getInteger('count');
      if (!Number.isInteger(count) || count < 1 || count > 100) {
        return reject(interaction, 'Purge count must be between 1 and 100.');
      }
      const deleted = await interaction.channel.bulkDelete(count, true);
      const embed = new EmbedBuilder().setColor(config.colors.danger)
        .setTitle('Messages purged').setDescription(`${deleted.size} messages purged by ${interaction.user} in ${interaction.channel}\nRequested: ${count}`).setTimestamp();
      const logged = await modLog(interaction.guild, embed);
      await interaction.reply({ content: `Purged ${deleted.size} messages. ${logStatus(logged)}`, ephemeral: true });
    },
  },
 ];

moderationCommands.helpers = { hasStaffAccess, authorizeMemberAction };
module.exports = moderationCommands;
