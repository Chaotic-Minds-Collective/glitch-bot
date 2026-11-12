const { EmbedBuilder } = require('discord.js');
const { queryServer } = require('./serverQuery');
const { createCoreApiClient } = require('../services/coreApi');
const config = require('../config');

const state = new Map();
let coreApiClient;
let lastCoreWarningAt = 0;

function getCoreApiClient() {
  if (!process.env.CORE_API_BASE_URL || !process.env.CORE_API_SERVICE_TOKEN) return null;
  if (!coreApiClient) coreApiClient = createCoreApiClient();
  return coreApiClient;
}

function getCoreGameKey(type) {
  if (type === 'atlas') return 'atlas';
  if (type === '7d2d') return '7dtd';
  if (type === 'ark') return 'ark';
  return null;
}

async function reportCoreHeartbeats(results) {
  let api;
  try {
    api = getCoreApiClient();
  } catch (error) {
    if (Date.now() - lastCoreWarningAt > 5 * 60 * 1000) {
      console.warn('[Core] Invalid Core API configuration:', error.code || 'CONFIGURATION_ERROR');
      lastCoreWarningAt = Date.now();
    }
    return;
  }
  if (!api) return;

  await Promise.all(results.filter((server) => server.coreServerId).map(async (server) => {
    const game = getCoreGameKey(server.type);
    if (!game) return;
    try {
      await api.sendServerHeartbeat(server.coreServerId, {
        game,
        serverVersion: server.serverVersion || 'unknown',
        adapterVersion: process.env.CORE_API_ADAPTER_VERSION || 'glitch-bot/1.0.0',
        online: server.online,
        playerCount: server.online ? server.players : 0,
        observedAt: new Date().toISOString(),
      });
    } catch (error) {
      if (Date.now() - lastCoreWarningAt > 5 * 60 * 1000) {
        console.warn('[Core] Server heartbeat could not be delivered:', error.code || 'REQUEST_FAILED');
        lastCoreWarningAt = Date.now();
      }
    }
  }));
}

async function check(client) {
  if (!config.gameServers.length) return;
  const results = await Promise.all(config.gameServers.map(queryServer));
  await reportCoreHeartbeats(results);

  if (!config.channels.serverStatus) return;
  const key = results.map((r) => `${r.name}:${r.online ? r.players : 'x'}`).join('|');
  if (state.has(key)) return;
  state.clear();
  state.set(key, true);

  const ch = client.channels.cache.get(config.channels.serverStatus);
  if (!ch) return;

  const lines = results.map((r) => r.online
    ? `:large_blue_circle: **${String(r.name).slice(0, 256)}** - ONLINE - ${r.players}/${r.maxPlayers} players${r.map ? ` - ${String(r.map).slice(0, 256)}` : ''}`
    : `:red_circle: **${String(r.name).slice(0, 256)}** - OFFLINE`);
  // Keep one embed within Discord's description and total text limits.
  const text = lines.join('\n');
  const description = text.length > 4096 ? `${text.slice(0, 4093)}...` : text;
  const changeKey = JSON.stringify(results.map((r) => [
    r.id, r.name, r.online, r.players, r.maxPlayers, r.map ?? null
  ]));
  if (changeKey === lastChangeKey) return;

  const embed = new EmbedBuilder().setColor(config.colors.primary)
    .setTitle('SERVER STATUS UPDATE').setDescription(description).setTimestamp();
  await ch.send({ embeds: [embed] });
  lastChangeKey = changeKey;
}

async function monitorLoop(client) {
  const runCheck = () => check(client).catch((error) => {
    console.error('[Server Status] Monitor cycle failed:', error.message);
  });
  await runCheck();
  setInterval(runCheck, 2 * 60 * 1000);
}

module.exports = { monitorLoop, getCoreGameKey };
