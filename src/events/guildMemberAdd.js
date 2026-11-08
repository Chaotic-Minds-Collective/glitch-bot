const { EmbedBuilder } = require('discord.js');
const config = require('../config');

module.exports = {
  name: 'guildMemberAdd',
  async execute(client, member) {
    const welcomeEmbed = new EmbedBuilder().setColor(config.colors.primary).setTitle('SIGNAL ACQUIRED')
      .setDescription(
        `Welcome, **${member.user.username}**!\n\n` +
        `Start in <#${config.channels.rules}> to read the Code. Then head to <#${config.channels.verify}> ` +
        `to verify, choose your games in #pick-your-world, and introduce yourself.\n\n` +
        'Community hub: https://chaoticmindsgaming.com'
      )
      .setThumbnail(member.displayAvatarURL())
      .setFooter({ text: 'Chaotic Gaming — Community built by gamers, for gamers.' });

    const welcomeChannel = config.channels.welcome
      ? await member.guild.channels.fetch(config.channels.welcome).catch(() => null) : null;
    if (welcomeChannel?.isTextBased()) {
      await welcomeChannel.send({ content: `Welcome <@${member.id}>!`, embeds: [welcomeEmbed] })
        .catch((error) => console.error('[Welcome] Could not post welcome message:', error));
    } else console.warn('[Welcome] CHANNEL_WELCOME is missing or is not a text channel.');

    const joinLog = config.channels.joinLog
      ? await member.guild.channels.fetch(config.channels.joinLog).catch(() => null) : null;
    if (joinLog?.isTextBased()) {
      const logEmbed = new EmbedBuilder().setColor(config.colors.ok).setTitle('MEMBER JOINED')
        .setDescription(`${member.user.tag} joined the server.`)
        .setThumbnail(member.displayAvatarURL()).setTimestamp();
      await joinLog.send({ embeds: [logEmbed] })
        .catch((error) => console.error('[Join Log] Could not post join log:', error));
    }

    try {
      await member.send(
        `**SIGNAL ACQUIRED.**\nWelcome to Chaotic Gaming, ${member.user.username}.\n\n` +
        `1. Read the Code in the rules channel.\n2. Verify in the verification channel.\n` +
        `3. Pick your world and introduce yourself.\n\nhttps://chaoticmindsgaming.com`
      );
    } catch { /* Members can disable direct messages. */ }
  },
};
