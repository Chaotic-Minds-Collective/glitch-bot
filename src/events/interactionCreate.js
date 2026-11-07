const { verifyClaim, verifyPanel } = require('../features/verify');
const { handleTicket } = require('../features/tickets');

module.exports = {
  name: 'interactionCreate',
  /** Route slash commands, buttons and modals to their handlers. */
  async execute(client, interaction) {
    try {
      if (interaction.isChatInputCommand()) {
        const cmd = client.commands.get(interaction.commandName);
        if (!cmd) return;
        return await cmd.execute(client, interaction);
      }
      if (interaction.isButton() || interaction.isModalSubmit()) {
        if (interaction.customId === 'verify_claim' || interaction.customId === 'verify_panel') {
          return await verifyClaim(interaction);
        }
        if (interaction.customId.startsWith('ticket_')) {
          return await handleTicket(interaction);
        }
      }
    } catch (err) {
      console.error('Interaction error:', err);
      const msg = { content: 'Something glitched. Try again in a moment.', ephemeral: true };
      if (interaction.deferred || interaction.replied) await interaction.followUp(msg).catch(() => {});
      else await interaction.reply(msg).catch(() => {});
    }
  },
};
