const { SlashCommandBuilder } = require('discord.js');
const { verifyPanel } = require('../features/verify');

module.exports = [
  {
    data: new SlashCommandBuilder()
      .setName('verifypanel')
      .setDescription('Post the verification panel in this channel (staff only)')
      .setDefaultMemberPermissions('0'),
    /** Handle /verifypanel: post the verification gate embed with claim button. */
    async execute(client, interaction) {
      return verifyPanel(interaction);
    },
  },
];
