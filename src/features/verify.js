const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const config = require('../config');

/**
 * Verification feature: one-tap role claim. Tapping the verify button grants
 * the Member role; game-role pickers come from server roles at wiring time.
 */
async function verifyClaim(interaction) {
  if (!config.roles.member) {
    return interaction.reply({ content: 'Member role not configured yet - staff, set ROLE_MEMBER in the bot config.', ephemeral: true });
  }
  const member = interaction.member;
  if (member.roles.cache.has(config.roles.member)) {
    return interaction.reply({ content: 'You are already verified, mind intact.', ephemeral: true });
  }
  await member.roles.add(config.roles.member);
  await interaction.reply({ content: '**VERIFIED.** Welcome to the Collective. Now pick your world in #pick-your-world.', ephemeral: true });
}

/**
 * Posts the standing verify panel into the current channel.
 */
async function verifyPanel(interaction) {
  const embed = new EmbedBuilder().setColor(config.colors.primary)
    .setTitle('VERIFICATION GATE')
    .setDescription('Tap the button to prove you are a real mind and unlock the full server.');
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('verify_claim').setLabel('VERIFY ME').setEmoji('\u{1F9E0}').setStyle(ButtonStyle.Success)
  );
  await interaction.channel.send({ embeds: [embed], components: [row] });
  await interaction.reply({ content: 'Verify panel posted.', ephemeral: true });
}

module.exports = { verifyClaim, verifyPanel };
