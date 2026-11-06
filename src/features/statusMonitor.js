const { EmbedBuilder } = require('discord.js');
const { queryServer } = require('./serverQuery');
const config = require('../config');

/**
 * Status monitor: queries every configured game server every 2 minutes and
 * posts an update in #server-status only when something changes.
 */
const state = new Map();

/**
 * Runs one status check and posts to the status channel on change.
 */
async function check(client) {
  if (!config.channels.serverStatus || !config.gameServers.length) return;
  const results = await Promise.all(config.gameServers.map(queryServer));
  const key = results.map((r) => `${r.name}:${r.online ? r.players : 'x'}`).join('|');
  if (state.has(key)) return;
  state.clear(); state.set(key, true);
  const ch = client.channels.cache.get(config.channels.serverStatus);
  if (!ch) return;
  const lines = results.map((r) => r.online
    ? `:large_blue_circle: **${r.name}** - ONLINE - ${r.players}/${r.maxPlayers} players${r.map ? ` - ${r.map}` : ''}`
    : `:red_circle: **${r.name}** - OFFLINE`);
  const embed = new EmbedBuilder().setColor(config.colors.primary)
    .setTitle('SERVER STATUS UPDATE').setDescription(lines.join('\n')).setTimestamp();
  await ch.send({ embeds: [embed] }).catch(() => {});
}

/**
 * Starts the monitor loop after the client is ready.
 */
async function monitorLoop(client) {
  await check(client);
  setInterval(() => check(client), 2 * 60 * 1000);
}

module.exports = { monitorLoop };
