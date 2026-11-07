const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../config');

module.exports = {
  name: 'guildMemberAdd',
  /** Post the custom SIGNAL ACQUIRED join message with a verify button, then send a welcome DM. */
  async execute(client, member) {
    const embed = new EmbedBuilder().setColor(config.colors.primary)
      .setTitle('SIGNAL ACQUIRED')
      .setDescription(`**${member.user.username}** has joined the Collective.\n\nGrab your roles in <#${config.channels.verify}>, decode the Code in <#${config.channels.rules}>, say hi in #introduce-yourself.`)
      .setThumbnail(member.displayAvatarURL())
      .setFooter({ text: 'Glitch is watching - approvingly.' });
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('verify_claim').setLabel('VERIFY - JOIN THE COLLECTIVE').setEmoji('🧠').setStyle(ButtonStyle.Success)
    );
    const ch = member.guild.channels.cache.get(config.channels.joinLog);
    if (ch) await ch.send({ content: `Welcome <@${member.id}>`, embeds: [embed], components: [row] });

    // Welcome DM
    try {
      await member.send(
        `**SIGNAL ACQUIRED.**\nWelcome to Chaotic Gaming, ${member.user.username}.\n\n` +
        `You have joined a community built by gamers, for gamers.\n` +
        `1. Verify in <#${config.channels.verify}>\n2. Read the Code in <#${config.channels.rules}>\n` +
        `3. Introduce yourself and pick your world.\n\nchaoticmindsgaming.com`
      );
    } catch { /* DMs closed - fine */ }
  },
};
