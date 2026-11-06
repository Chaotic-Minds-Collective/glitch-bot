const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../config');

/**
 * /ticketpanel: posts the standing support-ticket panel with an open button.
 * Staff-only via permissions (configured at wiring time).
 */
module.exports = [
  {
    data: new SlashCommandBuilder()
      .setName('ticketpanel')
      .setDescription('Post the support ticket panel in this channel')
      .setDefaultMemberPermissions('0'),
    async execute(client, interaction) {
      const embed = new EmbedBuilder().setColor(config.colors.primary)
        .setTitle('SUPPORT - OPEN A TICKET')
        .setDescription('Got an issue, a report, or need staff? Tap below and a private ticket channel opens. Only you and staff can see it.');
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_open').setLabel('Open a ticket').setEmoji('\u{1F3AB}').setStyle(ButtonStyle.Primary)
      );
      await interaction.channel.send({ embeds: [embed], components: [row] });
      await interaction.reply({ content: 'Ticket panel posted.', ephemeral: true });
    },
  },
];
