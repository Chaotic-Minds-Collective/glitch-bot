const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../config');
const { requireStaff, replyEphemeral } = require('../security/permissions');

module.exports = [{
  data: new SlashCommandBuilder().setName('ticketpanel')
    .setDescription('Post the support ticket panel in this channel')
    .setDefaultMemberPermissions(null),
  async execute(client, interaction) {
    if (!await requireStaff(interaction, 'post the support ticket panel')) return;
    if (!interaction.inGuild()) return replyEphemeral(interaction, 'The ticket panel can only be posted inside the server.');
    const embed = new EmbedBuilder().setColor(config.colors.primary).setTitle('SUPPORT - OPEN A TICKET')
      .setDescription('Need help, want to report an issue, or need staff? Open a private ticket below. Only you and authorized staff can see it.');
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket_open').setLabel('Open a ticket')
        .setEmoji('🎫').setStyle(ButtonStyle.Primary)
    );
    await interaction.channel.send({ embeds: [embed], components: [row] });
    return replyEphemeral(interaction, 'Ticket panel posted.');
  },
}];
