const { SlashCommandBuilder } = require('discord.js');
const { gamePanel } = require('../features/games');

module.exports = [{
  data: new SlashCommandBuilder()
    .setName('gamepanel')
    .setDescription('Post the game role selection panel in pick-your-world')
    .setDefaultMemberPermissions(null),
  /**
   * Delegate the staff game panel command to its feature handler.
   * @param {import('discord.js').Client} client Client supplied by the command router.
   * @param {import('discord.js').ChatInputCommandInteraction} interaction Panel command.
   * @returns {Promise<unknown>} Feature handler response.
   */
  async execute(client, interaction) {
    return gamePanel(interaction);
  },
}];
