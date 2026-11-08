const { SlashCommandBuilder } = require('discord.js');
const { rulesPanel } = require('../features/rules');

module.exports = [{
  data: new SlashCommandBuilder()
    .setName('rulespanel')
    .setDescription('Post the rules acceptance panel in the configured rules channel')
    .setDefaultMemberPermissions(null),
  /**
   * Delegate the staff rules acceptance panel command to its feature handler.
   * @param {import('discord.js').Client} client Client supplied by the command router.
   * @param {import('discord.js').ChatInputCommandInteraction} interaction Panel command.
   * @returns {Promise<unknown>} Feature handler response.
   */
  async execute(client, interaction) {
    return rulesPanel(interaction);
  },
}];
