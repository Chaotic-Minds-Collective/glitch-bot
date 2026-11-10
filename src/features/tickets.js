const {
  ChannelType, PermissionFlagsBits, MessageFlags, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder,
  TextInputBuilder, TextInputStyle,
} = require('discord.js');
const config = require('../config');
const { canCloseTicket, isTicketChannel, replyEphemeral, ticketOwnerId } = require('../security/permissions');

const pendingTicketCreations = new Set();

/**
 * Build a stable, Discord-safe channel name for a ticket requester.
 * @param {import('discord.js').User} user Ticket requester.
 * @returns {string} Sanitized channel name.
 */
function ticketChannelName(user) {
  const safeName = user.username.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').slice(0, 35);
  return `ticket-${safeName || 'member'}-${user.id.slice(-4)}`.slice(0, 90);
}

/**
 * Acquire a process-local lock so simultaneous submissions cannot create
 * duplicate tickets for the same guild member.
 * @param {string} guildId Discord guild ID.
 * @param {string} userId Discord user ID.
 * @returns {boolean} Whether the lock was acquired.
 */
function acquireTicketCreationLock(guildId, userId) {
  const key = `${guildId}:${userId}`;
  if (pendingTicketCreations.has(key)) return false;
  pendingTicketCreations.add(key);
  return true;
}

/**
 * Release a previously acquired ticket-creation lock.
 * @param {string} guildId Discord guild ID.
 * @param {string} userId Discord user ID.
 * @returns {void}
 */
function releaseTicketCreationLock(guildId, userId) {
  pendingTicketCreations.delete(`${guildId}:${userId}`);
}

/**
 * Build private-channel overwrites for the requester, configured staff, and bot.
 * The bot receives explicit access so it can post and manage the ticket.
 * @param {import('discord.js').Guild} guild Guild that owns the ticket.
 * @param {string} requesterId Ticket requester's user ID.
 * @param {string} botId Bot user ID.
 * @returns {import('discord.js').OverwriteResolvable[]} Permission overwrites.
 */
function buildTicketPermissionOverwrites(guild, requesterId, botId) {
  const readAndReply = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.ReadMessageHistory,
  ];
  const overwrites = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: requesterId,
      allow: [...readAndReply, PermissionFlagsBits.AttachFiles],
    },
    {
      id: botId,
      allow: [...readAndReply, PermissionFlagsBits.EmbedLinks],
    },
  ];

  for (const roleId of [config.roles.staff, config.roles.moderator].filter(Boolean)) {
    overwrites.push({ id: roleId, allow: [...readAndReply, PermissionFlagsBits.EmbedLinks] });
  }
  return overwrites;
}

/**
 * Find an existing ticket owned by this user in the configured ticket category.
 * @param {import('discord.js').Guild} guild Guild to search.
 * @param {string} userId Ticket owner's user ID.
 * @returns {Promise<import('discord.js').TextChannel|null>} Existing ticket or null.
 */
async function findExistingTicket(guild, userId) {
  const channels = await guild.channels.fetch();
  return channels.find((channel) => isTicketChannel(channel) && ticketOwnerId(channel) === userId) || null;
}

/**
 * Handle ticket panel, modal submission, and ticket closure interactions.
 * Serialize ticket creation per member, verify bot permissions, and clean up
 * a channel if its initial ticket message cannot be posted.
 * @param {import('discord.js').Interaction} interaction Incoming Discord interaction.
 * @returns {Promise<unknown>} Completion of the interaction response and action.
 */
async function handleTicket(interaction) {
  if (!interaction.inGuild()) return replyEphemeral(interaction, 'Tickets can only be used inside the Chaotic Gaming server.');

  if (interaction.isButton() && interaction.customId === 'ticket_open') {
    const existing = await findExistingTicket(interaction.guild, interaction.user.id);
    if (existing) return replyEphemeral(interaction, `You already have an open ticket: ${existing}`);
    const modal = new ModalBuilder().setCustomId('ticket_reason').setTitle('Open a ticket')
      .addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('reason').setLabel('What do you need help with?')
          .setStyle(TextInputStyle.Paragraph).setMaxLength(1000).setRequired(true)
      ));
    return interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && interaction.customId === 'ticket_reason') {
    const { guild, user } = interaction;
    if (!acquireTicketCreationLock(guild.id, user.id)) {
      return replyEphemeral(interaction, 'Your ticket is already being created. Please wait a moment.');
    }

    try {
      const existing = await findExistingTicket(guild, user.id);
      if (existing) return replyEphemeral(interaction, `You already have an open ticket: ${existing}`);

      const reason = interaction.fields.getTextInputValue('reason').trim().slice(0, 1000);
      if (!reason) return replyEphemeral(interaction, 'Please provide a short description before opening a ticket.');

      const botMember = guild.members.me || await guild.members.fetchMe();
      if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
        console.error('[Ticket] Bot lacks Manage Channels permission.');
        return replyEphemeral(interaction, 'Ticket creation is temporarily unavailable. Please contact staff.');
      }

      const channel = await guild.channels.create({
        name: ticketChannelName(user),
        type: ChannelType.GuildText,
        parent: config.channels.tickets || undefined,
        topic: `ticket-owner:${user.id}`,
        permissionOverwrites: buildTicketPermissionOverwrites(guild, user.id, interaction.client.user.id),
        reason: `Support ticket opened by ${user.tag}`,
      });

      const embed = new EmbedBuilder().setColor(config.colors.primary).setTitle('SUPPORT TICKET')
        .setDescription(`Opened by ${user}\\n\\n**Issue:** ${reason}`).setTimestamp();
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_close').setLabel('Close ticket')
          .setEmoji('🔒').setStyle(ButtonStyle.Danger)
      );

      try {
        await channel.send({
          content: config.roles.staff ? `<@${user.id}> <@&${config.roles.staff}>` : `<@${user.id}>`,
          embeds: [embed], components: [row],
          allowedMentions: { users: [user.id], roles: config.roles.staff ? [config.roles.staff] : [] },
        });
      } catch (error) {
        console.error('[Ticket] Could not post the initial ticket message:', error);
        try {
          await channel.delete('Ticket setup failed because the initial message could not be posted.');
        } catch (cleanupError) {
          console.error('[Ticket] Could not remove the incomplete ticket channel:', cleanupError);
        }
        return replyEphemeral(interaction, 'I could not finish creating your ticket. Please contact staff.');
      }

      return replyEphemeral(interaction, `Your private ticket is ready: ${channel}`);
    } catch (error) {
      console.error('[Ticket] Ticket creation failed:', error);
      return replyEphemeral(interaction, 'Ticket creation failed. Please try again or contact staff.');
    } finally {
      releaseTicketCreationLock(guild.id, user.id);
    }
  }

  if (interaction.isButton() && interaction.customId === 'ticket_close') {
    if (!canCloseTicket(interaction, interaction.channel)) {
      return replyEphemeral(interaction, 'Only the ticket owner or authorized staff can close this ticket.');
    }
    await interaction.reply({ content: 'Ticket closed.', flags: MessageFlags.Ephemeral });
    try {
      await interaction.channel.delete(`Ticket closed by ${interaction.user.tag}`);
    } catch (error) {
      console.error('[Ticket] Ticket deletion failed:', error);
      return replyEphemeral(interaction, 'The ticket could not be deleted. Please contact staff.');
    }
  }
}

module.exports = {
  handleTicket,
  ticketChannelName,
  acquireTicketCreationLock,
  releaseTicketCreationLock,
  buildTicketPermissionOverwrites,
  findExistingTicket,
};
