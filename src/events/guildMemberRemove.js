const { EmbedBuilder } = require('discord.js');
const config = require('../config');

module.exports = {
  name: 'guildMemberRemove',
  /**
   * Post the SIGNAL LOST leave message to the configured staff log.
   * Fetch the destination rather than relying on cache and handle missing
   * channels or Discord send failures without an unhandled rejection.
   * @param {import('discord.js').Client} client Client supplied by the event loader.
   * @param {import('discord.js').GuildMember} member Departing guild member.
   * @returns {Promise<void>} Completion of the leave-log attempt.
   */
  async execute(client, member) {
    const ch = config.channels.leaveLog
      ? await member.guild.channels.fetch(config.channels.leaveLog).catch(() => null) : null;
    if (!ch?.isTextBased()) {
      console.warn('[Leave Log] CHANNEL_LEAVE_LOG is missing or is not a text channel.');
      return;
    }
    const embed = new EmbedBuilder().setColor(config.colors.primary)
      .setTitle('SIGNAL LOST')
      .setDescription(`**${member.user.username}** has left the Collective. The static takes another.`)
      .setTimestamp();
    await ch.send({ embeds: [embed] })
      .catch((error) => console.error('[Leave Log] Could not post leave log:', error));
  },
};
