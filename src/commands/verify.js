const { SlashCommandBuilder } = require('discord.js');
const { verifyPanel } = require('../features/verify');

module.exports = [{
  data: new SlashCommandBuilder().setName('verifypanel')
    .setDescription('Post the verification panel in the configured verification channel')
    .setDefaultMemberPermissions(null),
  async execute(client, interaction) { return verifyPanel(interaction); },
}];
