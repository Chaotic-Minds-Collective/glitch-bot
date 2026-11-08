const { SlashCommandBuilder } = require('discord.js');
const { rulesPanel } = require('../features/rules');

module.exports = [{
  data: new SlashCommandBuilder()
    .setName('rulespanel')
    .setDescription('Post the rules acceptance panel in the configured rules channel')
    .setDefaultMemberPermissions(null),
  async execute(client, interaction) {
    return rulesPanel(interaction);
  },
}];
