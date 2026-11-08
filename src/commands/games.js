const { SlashCommandBuilder } = require('discord.js');
const { gamePanel } = require('../features/games');

module.exports = [{
  data: new SlashCommandBuilder()
    .setName('gamepanel')
    .setDescription('Post the game role selection panel in pick-your-world')
    .setDefaultMemberPermissions(null),
  async execute(client, interaction) {
    return gamePanel(interaction);
  },
}];
