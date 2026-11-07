const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const config = require('../config');

/**
 * Role claim: tapping the verify button grants the Member role.
 * @param {import('discord.js').Interaction} interaction - button interaction from the verify panel
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
  await interaction.reply({ content: '**VERIFIED.** Welcome to the Collective. Pick your world in #pick-your-world.', ephemeral: true });
}

/**
 * Post the standing verify panel into the current channel. Run once via /verifypanel.
 * @param {import('discord.js').Interaction} interaction - staff-only slash interaction
 */
async function verifyPanel(interaction) {
  const embed = new EmbedBuilder().setColor(config.colors.primary)
    .setTitle('VERIFICATION GATE')
    .setDescription('Tap the button to prove you are a real mind and unlock the full server.');
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('verify_claim').setLabel('VERIFY ME').setEmoji('🧠').setStyle(ButtonStyle.Success)
  );
  await interaction.channel.send({ embeds: [embed], components: [row] });
  await interaction.reply({ content: 'Verify panel posted.', ephemeral: true });
}

module.exports = { verifyClaim, verifyPanel };
