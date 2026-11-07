const { EmbedBuilder } = require('discord.js');
const config = require('../config');

module.exports = {
  name: 'guildMemberRemove',
  /** Post the SIGNAL LOST leave message to the leave log. */
  async execute(client, member) {
    const ch = member.guild.channels.cache.get(config.channels.leaveLog);
    if (!ch) return;
    const embed = new EmbedBuilder().setColor(config.colors.primary)
      .setTitle('SIGNAL LOST')
      .setDescription(`**${member.user.username}** has left the Collective. The static takes another.`);
    await ch.send({ embeds: [embed] });
  },
};
