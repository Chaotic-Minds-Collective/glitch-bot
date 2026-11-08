const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const config = require('../config');
const { requireStaff, replyEphemeral } = require('../security/permissions');

/**
 * Check Manage Roles permission and the bot's position above the target role.
 * @param {import('discord.js').Guild} guild Guild containing the bot and role.
 * @param {import('discord.js').Role} role Target role to compare with the bot.
 * @returns {Promise<boolean>} Whether the permission and hierarchy checks pass.
 */
async function canAssignRole(guild, role) {
  const botMember = guild.members.me || await guild.members.fetchMe();
  return botMember.permissions.has(PermissionFlagsBits.ManageRoles) &&
    botMember.roles.highest.comparePositionTo(role) > 0;
}

/**
 * Record a guild member's acceptance using the configured Rules Accepted role.
 * Validate configuration and bot permissions before assigning it, acknowledge
 * existing acceptance, and direct the member to verification in a private reply.
 * @param {import('discord.js').ButtonInteraction} interaction Acceptance button.
 * @returns {Promise<unknown>} Completion of the private acceptance response.
 */
async function acceptRules(interaction) {
  if (!interaction.inGuild()) {
    return replyEphemeral(interaction, 'Rules acceptance is only available inside Chaotic Gaming.');
  }

  const roleId = config.roles.rulesAccepted;
  if (!roleId) {
    return replyEphemeral(interaction, 'The Rules Accepted role is not configured yet. Please contact staff.');
  }

  const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
  if (!role) return replyEphemeral(interaction, 'The Rules Accepted role could not be found. Please contact staff.');
  if (!await canAssignRole(interaction.guild, role)) {
    console.error('[Rules] Bot lacks Manage Roles or the Rules Accepted role is above its highest role.');
    return replyEphemeral(interaction, 'Rules acceptance is temporarily unavailable. Please contact staff.');
  }

  const member = await interaction.guild.members.fetch(interaction.user.id);
  if (member.roles.cache.has(role.id)) {
    return replyEphemeral(interaction, `Your rules acceptance is already recorded. Continue in ${config.channels.verify ? `<#${config.channels.verify}>` : '#verify'}.`);
  }

  await member.roles.add(role, 'Member accepted the Chaotic Gaming community rules.');
  return replyEphemeral(interaction, `Rules accepted. Your next step is verification in ${config.channels.verify ? `<#${config.channels.verify}>` : '#verify'}.`);
}

/**
 * Let authorized staff post the acceptance button in the configured rules channel.
 * Reply privately when guild or text-channel configuration is unavailable.
 * @param {import('discord.js').ChatInputCommandInteraction} interaction Panel command.
 * @returns {Promise<unknown>} Completion of the private command response.
 */
async function rulesPanel(interaction) {
  if (!await requireStaff(interaction, 'post the rules acceptance panel')) return;
  if (!interaction.inGuild()) return replyEphemeral(interaction, 'The rules panel can only be posted inside the server.');
  if (!config.channels.rules) return replyEphemeral(interaction, 'CHANNEL_RULES is not configured.');

  const channel = await interaction.guild.channels.fetch(config.channels.rules).catch(() => null);
  if (!channel?.isTextBased()) return replyEphemeral(interaction, 'The configured rules channel could not be found.');

  const embed = new EmbedBuilder()
    .setColor(config.colors.primary)
    .setTitle('THE COMMUNITY CODE')
    .setDescription(
      'Please read the rules above before continuing. By selecting **I Agree**, you confirm that you have read and agree to follow the Chaotic Gaming community rules.\n\n' +
      'After accepting, continue to the verification channel to unlock the member areas.'
    )
    .setFooter({ text: 'Chaotic Gaming • Community built by gamers, for gamers.' });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('rules_accept')
      .setLabel('I AGREE — ACCEPT RULES')
      .setStyle(ButtonStyle.Success)
  );

  await channel.send({ embeds: [embed], components: [row] });
  return replyEphemeral(interaction, `Rules acceptance panel posted in <#${channel.id}>.`);
}

module.exports = { acceptRules, rulesPanel };
