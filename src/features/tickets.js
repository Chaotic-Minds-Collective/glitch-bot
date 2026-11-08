const {
  ChannelType, PermissionFlagsBits, MessageFlags, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder,
  TextInputBuilder, TextInputStyle,
} = require('discord.js');
const config = require('../config');
const { canCloseTicket, replyEphemeral } = require('../security/permissions');

function ticketChannelName(user) {
  const safeName = user.username.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').slice(0, 35);
  return `ticket-${safeName || 'member'}-${user.id.slice(-4)}`.slice(0, 90);
}

async function findExistingTicket(guild, userId) {
  const channels = await guild.channels.fetch();
  return channels.find((channel) =>
    channel?.type === ChannelType.GuildText && channel.topic?.includes(`ticket-owner:${userId}`)
  ) || null;
}

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
    const existing = await findExistingTicket(interaction.guild, interaction.user.id);
    if (existing) return replyEphemeral(interaction, `You already have an open ticket: ${existing}`);
    const reason = interaction.fields.getTextInputValue('reason').trim().slice(0, 1000);
    if (!reason) return replyEphemeral(interaction, 'Please provide a short description before opening a ticket.');

    const overwrites = [
      { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: interaction.user.id, allow: [
        PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles,
      ] },
    ];
    for (const roleId of [config.roles.staff, config.roles.moderator].filter(Boolean)) {
      overwrites.push({ id: roleId, allow: [
        PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
      ] });
    }

    const channel = await interaction.guild.channels.create({
      name: ticketChannelName(interaction.user),
      type: ChannelType.GuildText,
      parent: config.channels.tickets || undefined,
      topic: `ticket-owner:${interaction.user.id}`,
      permissionOverwrites: overwrites,
      reason: `Support ticket opened by ${interaction.user.tag}`,
    });

    const embed = new EmbedBuilder().setColor(config.colors.primary).setTitle('SUPPORT TICKET')
      .setDescription(`Opened by ${interaction.user}\n\n**Issue:** ${reason}`).setTimestamp();
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket_close').setLabel('Close ticket')
        .setEmoji('🔒').setStyle(ButtonStyle.Danger)
    );
    await channel.send({
      content: config.roles.staff ? `<@${interaction.user.id}> <@&${config.roles.staff}>` : `<@${interaction.user.id}>`,
      embeds: [embed], components: [row],
      allowedMentions: { users: [interaction.user.id], roles: config.roles.staff ? [config.roles.staff] : [] },
    });
    return replyEphemeral(interaction, `Your private ticket is ready: ${channel}`);
  }

  if (interaction.isButton() && interaction.customId === 'ticket_close') {
    if (!canCloseTicket(interaction, interaction.channel)) {
      return replyEphemeral(interaction, 'Only the ticket owner or authorized staff can close this ticket.');
    }
    await interaction.reply({ content: 'This ticket will close in 5 seconds.', flags: MessageFlags.Ephemeral });
    setTimeout(() => {
      interaction.channel.delete(`Ticket closed by ${interaction.user.tag}`).catch((error) =>
        console.error('Ticket deletion failed:', error));
    }, 5000);
  }
}

module.exports = { handleTicket };
