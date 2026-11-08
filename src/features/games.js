const {
  ActionRowBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
} = require('discord.js');
const config = require('../config');
const { requireStaff, replyEphemeral } = require('../security/permissions');

function configuredGames() {
  return config.gameRoles.filter((game) => game.roleId);
}

async function gamePanel(interaction) {
  if (!await requireStaff(interaction, 'post the game selection panel')) return;
  if (!interaction.inGuild()) return replyEphemeral(interaction, 'The game panel can only be posted inside the server.');
  if (!config.channels.pickYourWorld) return replyEphemeral(interaction, 'CHANNEL_PICK_YOUR_WORLD is not configured.');

  const games = configuredGames();
  if (!games.length) return replyEphemeral(interaction, 'No game roles are configured.');

  const channel = await interaction.guild.channels.fetch(config.channels.pickYourWorld).catch(() => null);
  if (!channel?.isTextBased()) return replyEphemeral(interaction, 'The configured pick-your-world channel could not be found.');

  const embed = new EmbedBuilder()
    .setColor(config.colors.primary)
    .setTitle('PICK YOUR WORLD')
    .setDescription(
      'Choose the games you play to receive the matching server roles and unlock the right community spaces. ' +
      'You can update your selections any time. Choose **Clear my game roles** to remove all game roles.'
    );

  const menu = new StringSelectMenuBuilder()
    .setCustomId('game_roles_select')
    .setPlaceholder('Select the games you play')
    .setMinValues(1)
    .setMaxValues(games.length)
    .addOptions(
      ...games.map((game) => ({
        label: game.label,
        value: game.value,
        description: `Get the ${game.label} community role`,
      })),
      { label: 'Clear my game roles', value: 'none', description: 'Remove all selected game roles' }
    );

  await channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] });
  return replyEphemeral(interaction, `Game selection panel posted in <#${channel.id}>.`);
}

async function selectGames(interaction) {
  if (!interaction.inGuild()) return replyEphemeral(interaction, 'Game selection is only available inside Chaotic Gaming.');

  const memberRoleId = config.roles.member;
  if (!memberRoleId) return replyEphemeral(interaction, 'Verification is not configured. Please contact staff.');

  const member = await interaction.guild.members.fetch(interaction.user.id);
  if (!member.roles.cache.has(memberRoleId)) {
    return replyEphemeral(interaction, `Please accept the rules and verify before choosing games in <#${config.channels.verify}>.`);
  }

  const games = configuredGames();
  if (!games.length) return replyEphemeral(interaction, 'Game roles are not configured yet. Please contact staff.');

  const selected = interaction.values;
  if (selected.includes('none') && selected.length !== 1) {
    return replyEphemeral(interaction, 'Choose either game roles or the clear option, not both.');
  }

  const selectedGames = selected.includes('none')
    ? []
    : games.filter((game) => selected.includes(game.value));

  if (selectedGames.length !== (selected.includes('none') ? 0 : selected.length)) {
    return replyEphemeral(interaction, 'One or more game selections are not recognized. Please try again.');
  }

  const targetRoles = [];
  for (const game of games) {
    const role = await interaction.guild.roles.fetch(game.roleId).catch(() => null);
    if (!role) return replyEphemeral(interaction, `The ${game.label} role is missing. Please contact staff.`);
    targetRoles.push({ game, role });
  }

  const botMember = interaction.guild.members.me || await interaction.guild.members.fetchMe();
  if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles) ||
      targetRoles.some(({ role }) => botMember.roles.highest.comparePositionTo(role) <= 0)) {
    console.error('[Game Roles] Bot lacks Manage Roles or a game role is above its highest role.');
    return replyEphemeral(interaction, 'Game role updates are temporarily unavailable. Please contact staff.');
  }

  const selectedRoleIds = new Set(selectedGames.map((game) => game.roleId));
  const toAdd = targetRoles.filter(({ role }) => selectedRoleIds.has(role.id) && !member.roles.cache.has(role.id));
  const toRemove = targetRoles.filter(({ role }) => !selectedRoleIds.has(role.id) && member.roles.cache.has(role.id));

  if (toAdd.length) await member.roles.add(toAdd.map(({ role }) => role), 'Member selected games in the Glitch Bot game picker.');
  if (toRemove.length) await member.roles.remove(toRemove.map(({ role }) => role), 'Member updated game selections in the Glitch Bot game picker.');

  const summary = selectedGames.length
    ? `Your game roles are updated: ${selectedGames.map((game) => game.label).join(', ')}.`
    : 'Your game roles have been cleared.';
  const intro = config.channels.introduceYourself ? ` When you're ready, introduce yourself in <#${config.channels.introduceYourself}>.` : '';
  return replyEphemeral(interaction, summary + intro);
}

module.exports = { gamePanel, selectGames };
