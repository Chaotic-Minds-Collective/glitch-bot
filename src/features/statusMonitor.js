const { EmbedBuilder } = require('discord.js');
const { queryServer } = require('./serverQuery');
const config = require('../config');

// Every 2 minutes: query each game server; post an update in #server-status only on change.
const state = new Map();

/**
 * Poll all configured game servers and post a status embed on any change.
 * @param {import('discord.js').Client} client - logged-in Discord client
 */
async function check(client) {
  if (!config.channels.serverStatus || !config.gameServers.length) return;
  const results = await Promise.all(config.gameServers.map(queryServer));
  const key = results.map((r) => `${r.name}:${r.online ? r.players : 'x'}`).join('|');
  if (state.has(key)) return; // no change
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
 * Start the recurring status monitor loop (first check + every 2 minutes).
 * @param {import('discord.js').Client} client - logged-in Discord client
 */
async function monitorLoop(client) {
  await check(client);
  setInterval(() => check(client), 2 * 60 * 1000);
}

module.exports = { monitorLoop };
