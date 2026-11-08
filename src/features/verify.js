const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../config');
const { requireStaff, replyEphemeral } = require('../security/permissions');

async function verifyClaim(interaction) {
  if (!interaction.inGuild()) return replyEphemeral(interaction, 'Verification is only available inside the Chaotic Gaming server.');
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

  const member = await interaction.guild.members.fetch(interaction.user.id);
  if (member.roles.cache.has(role.id)) return replyEphemeral(interaction, 'You are already verified. Pick your world and introduce yourself!');
  await member.roles.add(role, 'Member completed the self-service verification button.');
  return replyEphemeral(interaction, '**VERIFIED.** Welcome to the Collective. Pick your world and introduce yourself!');
}

async function verifyPanel(interaction) {
  if (!await requireStaff(interaction, 'post the verification panel')) return;
  if (!interaction.inGuild()) return replyEphemeral(interaction, 'The verification panel can only be posted inside the server.');
  const embed = new EmbedBuilder().setColor(config.colors.primary).setTitle('VERIFICATION GATE')
    .setDescription('Tap the button to verify your account and unlock the member areas.');
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('verify_claim').setLabel('VERIFY ME')
      .setEmoji('🧠').setStyle(ButtonStyle.Success)
  );
  await interaction.channel.send({ embeds: [embed], components: [row] });
  return replyEphemeral(interaction, 'Verification panel posted.');
}

module.exports = { verifyClaim, verifyPanel };
