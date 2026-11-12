const { EmbedBuilder } = require('discord.js');
const { queryServer } = require('./serverQuery');
const { createCoreApiClient } = require('../services/coreApi');
const config = require('../config');

const coreApi = createCoreApiClient({ baseUrl: config.coreApiUrl });
const state = new Map();
let lastCoreWarningAt = 0;

async function getServerResults() {
  if (coreApi) {
    try {
      const servers = await coreApi.getServers();
      if (servers.length > 0) return servers;
    } catch (error) {
      if (Date.now() - lastCoreWarningAt > 15 * 60 * 1000) {
        console.warn('[Core API] Server catalog unavailable; falling back to local GameDig configuration:', error.message);
        lastCoreWarningAt = Date.now();
      }
    }
  }

  // Preserve current behavior when Core is not configured, offline, or has no
  // production-listed servers yet. The bot remains useful independently.
  return Promise.all(config.gameServers.map(queryServer));
}

// Every 2 minutes: prefer the canonical Core catalog; fall back to GameDig.
async function check(client) {
  if (!config.channels.serverStatus) return;
  const results = await getServerResults();
  if (!results.length) return;

  const key = results.map((r) => `${r.id || r.name}:${r.online ? r.players : 'x'}`).join('|');
  if (state.has(key)) return;
  state.clear();
  state.set(key, true);

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
  setInterval(() => check(client).catch((error) => {
    console.error('[Server Status] Monitor cycle failed:', error.message);
  }), 2 * 60 * 1000);
}

module.exports = { monitorLoop, getServerResults };
