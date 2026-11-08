const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../config');
const { requireStaff, replyEphemeral } = require('../security/permissions');

/**
 * Grant the configured member role only after the guild member accepts the rules.
 * Validate both roles and bot permissions, acknowledge existing verification,
 * and direct successful members to game selection through a private reply.
 * @param {import('discord.js').ButtonInteraction} interaction Verification button.
 * @returns {Promise<unknown>} Completion of the private verification response.
 */
async function verifyClaim(interaction) {
  if (!interaction.inGuild()) return replyEphemeral(interaction, 'Verification is only available inside the Chaotic Gaming server.');

  const acceptedRoleId = config.roles.rulesAccepted;
  if (!acceptedRoleId) {
    return replyEphemeral(interaction, 'The Rules Accepted role is not configured yet. Please contact staff.');
  }
  const acceptedRole = await interaction.guild.roles.fetch(acceptedRoleId).catch(() => null);
  if (!acceptedRole) return replyEphemeral(interaction, 'The Rules Accepted role could not be found. Please contact staff.');

  const member = await interaction.guild.members.fetch(interaction.user.id);
  if (!member.roles.cache.has(acceptedRole.id)) {
    return replyEphemeral(interaction, `Please read and accept the rules in <#${config.channels.rules}> before verifying.`);
  }

  const roleId = config.roles.member;
  if (!roleId) return replyEphemeral(interaction, 'Verification is not configured yet. Please contact staff.');
  const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
  if (!role) return replyEphemeral(interaction, 'The verification role could not be found. Please contact staff.');

  const botMember = interaction.guild.members.me || await interaction.guild.members.fetchMe();
  if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles) ||
      botMember.roles.highest.comparePositionTo(role) <= 0) {
    console.error('[Verification] Bot lacks Manage Roles or the Member role is above its highest role.');
    return replyEphemeral(interaction, 'Verification is temporarily unavailable. Please contact staff.');
  }

  if (member.roles.cache.has(role.id)) {
    return replyEphemeral(interaction, `You are already verified. Choose your games in <#${config.channels.pickYourWorld}>.`);
  }
  await member.roles.add(role, 'Member completed rules acceptance and self-service verification.');
  return replyEphemeral(interaction, `**VERIFIED.** Welcome to the Collective. Choose your games in <#${config.channels.pickYourWorld}>.`);
}

/**
 * Let authorized staff post the verification button in its configured text channel.
 * Reply privately if the guild or verification channel cannot be used.
 * @param {import('discord.js').ChatInputCommandInteraction} interaction Panel command.
 * @returns {Promise<unknown>} Completion of the private command response.
 */
async function verifyPanel(interaction) {
  if (!await requireStaff(interaction, 'post the verification panel')) return;
  if (!interaction.inGuild()) return replyEphemeral(interaction, 'The verification panel can only be posted inside the server.');
  if (!config.channels.verify) return replyEphemeral(interaction, 'CHANNEL_VERIFY is not configured.');

  const channel = await interaction.guild.channels.fetch(config.channels.verify).catch(() => null);
  if (!channel?.isTextBased()) return replyEphemeral(interaction, 'The configured verification channel could not be found.');

  const embed = new EmbedBuilder().setColor(config.colors.primary).setTitle('VERIFICATION GATE')
    .setDescription('Read and accept the community rules first. Then tap below to receive your Verified role and unlock member areas.');
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('verify_claim').setLabel('VERIFY ME')
      .setEmoji('🧠').setStyle(ButtonStyle.Success)
  );
  await channel.send({ embeds: [embed], components: [row] });
  return replyEphemeral(interaction, `Verification panel posted in <#${channel.id}>.`);
}

module.exports = { verifyClaim, verifyPanel };
