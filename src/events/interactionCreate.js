const { MessageFlags } = require('discord.js');
const { verifyClaim } = require('../features/verify');
const { acceptRules } = require('../features/rules');
const { selectGames } = require('../features/games');
const { handleTicket } = require('../features/tickets');

module.exports = {
  name: 'interactionCreate',
  /**
   * Route commands, onboarding components, and ticket buttons/modals to handlers.
   * Log handler failures and attempt a private reply or follow-up when supported.
   * @param {import('discord.js').Client} client Client with registered commands.
   * @param {import('discord.js').Interaction} interaction Incoming Discord interaction.
   * @returns {Promise<unknown>} Handler result or completion of error handling.
   */
  async execute(client, interaction) {
    try {
      if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;
        return await command.execute(client, interaction);
      }

      if (interaction.isButton()) {
        if (interaction.customId === 'rules_accept') return await acceptRules(interaction);
        if (interaction.customId === 'verify_claim') return await verifyClaim(interaction);
        if (interaction.customId.startsWith('ticket_')) return await handleTicket(interaction);
      }

      if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'game_roles_select') return await selectGames(interaction);
      }

      if (interaction.isModalSubmit() && interaction.customId.startsWith('ticket_')) {
        return await handleTicket(interaction);
      }
    } catch (error) {
      console.error('[Interaction Error]', error);
      const payload = {
        content: 'Something glitched while processing that action. Please try again or contact staff.',
        flags: MessageFlags.Ephemeral,
      };
      if (interaction.deferred || interaction.replied) await interaction.followUp(payload).catch(() => {});
      else if (interaction.isRepliable()) await interaction.reply(payload).catch(() => {});
    }
  },
};
