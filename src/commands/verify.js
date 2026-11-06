const { SlashCommandBuilder } = require('discord.js');
const { verifyPanel } = require('../features/verify');

/**
 * /verifypanel: posts the standing verification gate into the current channel.
 * Staff-only via permissions (configured at wiring time).
 */
module.exports = [
  {
    data: new SlashCommandBuilder()
      .setName('verifypanel')
      .setDescription('Post the verification panel in this channel (staff only)')
      .setDefaultMemberPermissions('0'),
    async execute(client, interaction) {
      return verifyPanel(interaction);
    },
  },
];
