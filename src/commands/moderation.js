const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const config = require('../config');

/**
 * Sends an embed to the configured mod-log channel.
 */
async function modLog(guild, embed) {
  if (!config.channels.modLog) return;
  const ch = guild.channels.cache.get(config.channels.modLog);
  if (ch) ch.send({ embeds: [embed] });
}

/**
 * Moderation commands: warn, timeout, kick, ban, purge. Every action is
 * logged to the mod-log channel. Each command is gated to the least
 * privilege that can perform it.
 */
module.exports = [
  {
    data: new SlashCommandBuilder()
      .setName('warn')
      .setDescription('Warn a member')
      .addUserOption((o) => o.setName('member').setDescription('Member to warn').setRequired(true))
      .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    async execute(client, interaction) {
      const member = interaction.options.getMember('member');
      const reason = interaction.options.getString('reason');
      try { await member.send(`You were warned in **${interaction.guild.name}**: ${reason}`); } catch {}
      const embed = new EmbedBuilder().setColor(config.colors.danger)
        .setTitle('Warning issued').setDescription(`${member} was warned by ${interaction.user}\n**Reason:** ${reason}`).setTimestamp();
      await modLog(interaction.guild, embed);
      await interaction.reply({ content: `Warned ${member.user.username}. Logged.`, ephemeral: true });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName('timeout')
      .setDescription('Timeout a member')
      .addUserOption((o) => o.setName('member').setDescription('Member').setRequired(true))
      .addIntegerOption((o) => o.setName('minutes').setDescription('Duration in minutes').setRequired(true))
      .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    async execute(client, interaction) {
      const member = interaction.options.getMember('member');
      const minutes = interaction.options.getInteger('minutes');
      const reason = interaction.options.getString('reason');
      await member.timeout(minutes * 60 * 1000, reason);
      const embed = new EmbedBuilder().setColor(config.colors.danger)
        .setTitle('Timeout issued').setDescription(`${member} timed out ${minutes}m by ${interaction.user}\n**Reason:** ${reason}`).setTimestamp();
      await modLog(interaction.guild, embed);
      await interaction.reply({ content: `Timed out ${member.user.username} for ${minutes} minutes.`, ephemeral: true });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName('kick')
      .setDescription('Kick a member')
      .addUserOption((o) => o.setName('member').setDescription('Member').setRequired(true))
      .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
    async execute(client, interaction) {
      const member = interaction.options.getMember('member');
      const reason = interaction.options.getString('reason');
      await member.kick(reason);
      const embed = new EmbedBuilder().setColor(config.colors.danger)
        .setTitle('Kick').setDescription(`${member} kicked by ${interaction.user}\n**Reason:** ${reason}`).setTimestamp();
      await modLog(interaction.guild, embed);
      await interaction.reply({ content: `Kicked ${member.user.username}.`, ephemeral: true });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName('ban')
      .setDescription('Ban a member')
      .addUserOption((o) => o.setName('member').setDescription('Member').setRequired(true))
      .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
    async execute(client, interaction) {
      const member = interaction.options.getMember('member');
      const reason = interaction.options.getString('reason');
      await member.ban({ reason });
      const embed = new EmbedBuilder().setColor(config.colors.danger)
        .setTitle('Ban').setDescription(`${member} banned by ${interaction.user}\n**Reason:** ${reason}`).setTimestamp();
      await modLog(interaction.guild, embed);
      await interaction.reply({ content: `Banned ${member.user.username}.`, ephemeral: true });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName('purge')
      .setDescription('Bulk delete messages in this channel')
      .addIntegerOption((o) => o.setName('count').setDescription('1-100').setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    async execute(client, interaction) {
      const count = Math.min(Math.max(interaction.options.getInteger('count'), 1), 100);
      const deleted = await interaction.channel.bulkDelete(count, true);
      await interaction.reply({ content: `Purged ${deleted.size} messages.`, ephemeral: true });
    },
  },
];
