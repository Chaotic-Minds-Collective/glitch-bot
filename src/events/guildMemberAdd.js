const { EmbedBuilder } = require('discord.js');
const config = require('../config');

module.exports = {
  name: 'guildMemberAdd',
  /**
   * Send onboarding steps to the welcome channel and member, and log the join.
   * Use channel-name fallbacks for missing onboarding IDs; log channel-send
   * failures and tolerate members who cannot receive direct messages.
   * @param {import('discord.js').Client} client Client supplied by the event loader.
   * @param {import('discord.js').GuildMember} member Newly joined guild member.
   * @returns {Promise<void>} Completion of welcome, join-log, and DM attempts.
   */
  async execute(client, member) {
    const rulesStep = config.channels.rules ? `<#${config.channels.rules}>` : '#rules';
    const verifyStep = config.channels.verify ? `<#${config.channels.verify}>` : '#verify';
    const gamesStep = config.channels.pickYourWorld ? `<#${config.channels.pickYourWorld}>` : '#pick-your-world';
    const introStep = config.channels.introduceYourself ? `<#${config.channels.introduceYourself}>` : '#introduce-yourself';

    const welcomeEmbed = new EmbedBuilder().setColor(config.colors.primary).setTitle('SIGNAL ACQUIRED')
      .setDescription(
        `Welcome, **${member.user.username}**!\n\n` +
        `Your onboarding path:\n1. Read the Code in ${rulesStep} and accept the rules.\n` +
        `2. Verify in ${verifyStep}.\n3. Choose your games in ${gamesStep}.\n` +
        `4. Introduce yourself in ${introStep}.\n\n` +
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
        `1. Read the Code in ${rulesStep} and accept the rules.\n2. Verify in ${verifyStep}.\n` +
        `3. Pick your games in ${gamesStep}.\n4. Introduce yourself in ${introStep}.\n\n` +
        'https://chaoticmindsgaming.com'
      );
    } catch { /* Members can disable direct messages. */ }
  },
};
