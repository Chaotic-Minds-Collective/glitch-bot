const {
  ActionRowBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  MessageFlags,
  StringSelectMenuBuilder,
} = require('discord.js');
const config = require('../config');
const { requireStaff, replyEphemeral } = require('../security/permissions');

const activeSelections = new Set();

/**
 * Return game options that have a configured Discord role ID.
 * @returns {Array<{value: string, label: string, roleId: string}>} Available games.
 */
function configuredGames() {
  return config.gameRoles.filter((game) => game.roleId);
}

/**
 * Let authorized staff post the game selector in the configured text channel.
 * Reply privately if configuration or channel validation fails.
 * @param {import('discord.js').ChatInputCommandInteraction} interaction Panel command.
 * @returns {Promise<unknown>} Completion of the private command response.
 */
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

/**
 * Update only configured game roles for a verified guild member.
 * Reject unknown selections, mixed clear/game choices, and unassignable roles
 * before adding or removing roles. Defer the reply, exclude overlapping requests
 * in this process, and confirm the game-role subset before reporting success.
 * @param {import('discord.js').StringSelectMenuInteraction} interaction Game choices.
 * @returns {Promise<unknown>} Completion of the private selection response.
 */
async function selectGames(interaction) {
  if (!interaction.inGuild()) return replyEphemeral(interaction, 'Game selection is only available inside Chaotic Gaming.');
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const key = `${interaction.guild.id}:${interaction.user.id}`;
  if (activeSelections.has(key)) {
    return interaction.editReply('Your previous game selection is still being processed. Please try again after it finishes.');
  }
  activeSelections.add(key);
  try {
    return await applyGameSelection(interaction);
  } catch (error) {
    console.error('[Game Roles] Selection could not be completed:', error);
    return interaction.editReply('Your game role update could not be confirmed and may be incomplete. Please try again or contact staff.');
  } finally {
    activeSelections.delete(key);
  }
}

/**
 * Apply one member's validated selection with role-specific writes, then fetch
 * current roles to confirm success. Failed writes may leave a partial selection.
 * @param {import('discord.js').StringSelectMenuInteraction} interaction Deferred selection.
 * @returns {Promise<unknown>} Completion of the edited private response.
 */
async function applyGameSelection(interaction) {
  if (!interaction.inGuild()) return interaction.editReply('Game selection is only available inside Chaotic Gaming.');

  const memberRoleId = config.roles.member;
  if (!memberRoleId) return interaction.editReply('Verification is not configured. Please contact staff.');

  const member = await interaction.guild.members.fetch({ user: interaction.user.id, force: true });
  if (!member.roles.cache.has(memberRoleId)) {
    const verifyStep = config.channels.verify ? `<#${config.channels.verify}>` : 'the verification channel';
    return interaction.editReply(`Please accept the rules and verify in ${verifyStep} before choosing games.`);
  }

  const games = configuredGames();
  if (!games.length) return interaction.editReply('Game roles are not configured yet. Please contact staff.');

  const protectedRoles = new Set(Object.values(config.roles).filter(Boolean));
  const gameRoleIds = games.map((game) => game.roleId);
  if (new Set(gameRoleIds).size !== games.length || gameRoleIds.some((id) => protectedRoles.has(id))) {
    return interaction.editReply('Game role configuration overlaps other roles. Please contact staff.');
  }

  const selected = interaction.values;
  if (selected.includes('none') && selected.length !== 1) {
    return interaction.editReply('Choose either game roles or the clear option, not both.');
  }

  const selectedGames = selected.includes('none')
    ? []
    : games.filter((game) => selected.includes(game.value));

  if (selectedGames.length !== (selected.includes('none') ? 0 : selected.length)) {
    return interaction.editReply('One or more game selections are not recognized. Please try again.');
  }

  const targetRoles = [];
  for (const game of games) {
    const role = await interaction.guild.roles.fetch(game.roleId).catch(() => null);
    if (!role) return interaction.editReply(`The ${game.label} role is missing. Please contact staff.`);
    targetRoles.push({ game, role });
  }

  const botMember = interaction.guild.members.me || await interaction.guild.members.fetchMe();
  if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles) ||
      targetRoles.some(({ role }) => botMember.roles.highest.comparePositionTo(role) <= 0)) {
    console.error('[Game Roles] Bot lacks Manage Roles or a game role is above its highest role.');
    return interaction.editReply('Game role updates are temporarily unavailable. Please contact staff.');
  }

  const selectedRoleIds = new Set(selectedGames.map((game) => game.roleId));
  const additions = targetRoles.filter(({ role }) => selectedRoleIds.has(role.id) && !member.roles.cache.has(role.id));
  const removals = targetRoles.filter(({ role }) => !selectedRoleIds.has(role.id) && member.roles.cache.has(role.id));
  const reason = 'Member updated game selections in the Glitch Bot game picker.';
  let writeFailed = false;
  for (const { role } of additions) {
    try {
      await member.roles.add(role.id, reason);
    } catch (error) {
      writeFailed = true;
      console.error('[Game Roles] Role addition failed:', error);
    }
  }
  for (const { role } of removals) {
    try {
      await member.roles.remove(role.id, reason);
    } catch (error) {
      writeFailed = true;
      console.error('[Game Roles] Role removal failed:', error);
    }
  }

  const current = await interaction.guild.members.fetch({ user: interaction.user.id, force: true }).catch(() => null);
  if (!current) {
    return interaction.editReply('Your game role update could not be confirmed and may be incomplete. Please try again or contact staff.');
  }
  if (writeFailed || targetRoles.some(({ role }) => current.roles.cache.has(role.id) !== selectedRoleIds.has(role.id))) {
    const actual = games.filter((game) => current.roles.cache.has(game.roleId)).map((game) => game.label);
    return interaction.editReply(`Your game role update is incomplete. Current game roles: ${actual.join(', ') || 'none'}. Please try again or contact staff.`);
  }

  const summary = selectedGames.length
    ? `Your game roles are updated: ${selectedGames.map((game) => game.label).join(', ')}.`
    : 'Your game roles have been cleared.';
  const intro = config.channels.introduceYourself ? ` When you're ready, introduce yourself in <#${config.channels.introduceYourself}>.` : '';
  return interaction.editReply(summary + intro);
}

module.exports = { gamePanel, selectGames };
