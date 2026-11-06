const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { queryServer } = require('../features/serverQuery');
const config = require('../config');

/**
 * /serverstatus: on-demand live status of every configured game server.
 */
module.exports = [
  {
    data: new SlashCommandBuilder()
      .setName('serverstatus')
      .setDescription('Check live status of all Chaotic Gaming servers'),
    async execute(client, interaction) {
      await interaction.deferReply();
      const results = await Promise.all(config.gameServers.map(queryServer));
      const embed = new EmbedBuilder().setColor(config.colors.primary).setTitle('SERVER STATUS');
      for (const r of results) {
        embed.addFields({
          name: r.online ? `${r.name} - ONLINE` : `${r.name} - OFFLINE`,
          value: r.online ? `${r.players}/${r.maxPlayers} players - ${r.map || 'unknown map'}` : 'No response from server.',
        });
      }
      if (!results.length) embed.setDescription('No servers configured yet.');
      await interaction.editReply({ embeds: [embed] });
    },
  },
];
