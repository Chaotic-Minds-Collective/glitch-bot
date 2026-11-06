const { ChannelType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const config = require('../config');
const counters = new Map();

/**
 * Ticket feature: modal-driven ticket channels. Open creates a private
 * channel visible to the member and staff; close deletes it after a delay.
 */
async function handleTicket(interaction) {
  if (interaction.isButton() && interaction.customId === 'ticket_open') {
    const modal = new ModalBuilder().setCustomId('ticket_reason').setTitle('Open a ticket')
      .addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('reason').setLabel('What do you need help with?').setStyle(TextInputStyle.Paragraph).setRequired(true)
      ));
    return interaction.showModal(modal);
  }
  if (interaction.isModalSubmit() && interaction.customId === 'ticket_reason') {
    const reason = interaction.fields.getTextInputValue('reason').slice(0, 1000);
    const n = (counters.get(interaction.guild.id) || 0) + 1;
    counters.set(interaction.guild.id, n);
    const overwrites = [
      { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
      { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    ];
    if (config.roles.staff) overwrites.push({ id: config.roles.staff, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });
    const ch = await interaction.guild.channels.create({
      name: `ticket-${n.toString().padStart(4, '0')}-${interaction.user.username}`.slice(0, 100),
      type: ChannelType.GuildText,
      parent: config.channels.tickets || undefined,
      permissionOverwrites: overwrites,
    });
    const embed = new EmbedBuilder().setColor(config.colors.primary)
      .setTitle(`Ticket #${n}`).setDescription(`Opened by ${interaction.user}\n**Issue:** ${reason}`).setTimestamp();
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket_close').setLabel('Close ticket').setEmoji('\u{1F512}').setStyle(ButtonStyle.Danger)
    );
    await ch.send({ content: `<@${interaction.user.id}>`, embeds: [embed], components: [row] });
    return interaction.reply({ content: `Ticket opened: <#${ch.id}>`, ephemeral: true });
  }
  if (interaction.isButton() && interaction.customId === 'ticket_close') {
    await interaction.reply({ content: 'Closing in 5 seconds.' });
    setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
  }
}

module.exports = { handleTicket };
