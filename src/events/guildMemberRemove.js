const { EmbedBuilder } = require('discord.js');
const config = require('../config');

/**
 * on guildMemberRemove: posts a SIGNAL LOST message to the leave log.
 */
module.exports = {
  name: 'guildMemberRemove',
  async execute(client, member) {
    const ch = member.guild.channels.cache.get(config.channels.leaveLog);
    if (!ch) return;
    const embed = new EmbedBuilder().setColor(config.colors.primary)
      .setTitle('SIGNAL LOST')
      .setDescription(`**${member.user.username}** has left the Collective. The static takes another.`);
    await ch.send({ embeds: [embed] });
  },
};
