const { MessageFlags, PermissionFlagsBits } = require('discord.js');
const config = require('../config');

function isOwner(userId) {
  return Boolean(config.ownerId && userId && userId === config.ownerId);
}

function hasStaffAccess(interaction) {
  if (!interaction?.user || !interaction?.member) return false;
  if (isOwner(interaction.user.id)) return true;
  const permissions = interaction.member.permissions;
  if (permissions?.has(PermissionFlagsBits.Administrator)) return true;
  const roles = interaction.member.roles?.cache;
  return [config.roles.staff, config.roles.moderator]
    .filter(Boolean)
    .some((roleId) => roles?.has(roleId));
}

async function replyEphemeral(interaction, content) {
  const payload = { content, flags: MessageFlags.Ephemeral };
  if (interaction.deferred || interaction.replied) return interaction.followUp(payload);
  return interaction.reply(payload);
}

async function requireStaff(interaction, action = 'use this control') {
  if (hasStaffAccess(interaction)) return true;
  await replyEphemeral(interaction, `You do not have permission to ${action}.`);
  return false;
}

function ticketOwnerId(channel) {
  const match = String(channel?.topic || '').match(/(?:^|\s)ticket-owner:(\d{17,20})(?:\s|$)/);
  return match ? match[1] : null;
}

function canCloseTicket(interaction, channel) {
  const ownerId = ticketOwnerId(channel);
  return Boolean(ownerId && interaction?.user?.id &&
    (interaction.user.id === ownerId || hasStaffAccess(interaction)));
}

module.exports = { isOwner, hasStaffAccess, requireStaff, replyEphemeral, ticketOwnerId, canCloseTicket };
