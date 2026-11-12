const { EmbedBuilder } = require("discord.js");
const { queryServer } = require("./serverQuery");
const { createCoreApiClient } = require("../services/coreApi");
const config = require("../config");

let coreApiClient;
let lastCoreWarningAt = 0;
let lastChangeKey;

function getCoreApiClient() {
  const settings = config.coreApi || {};
  if (!settings.baseUrl) return null;
  if (!coreApiClient) {
    coreApiClient = createCoreApiClient({
      baseUrl: settings.baseUrl,
      serviceToken: settings.serviceToken,
      timeoutMs: settings.timeoutMs,
    });
  }
  return coreApiClient;
}

function warnCore(error) {
  if (Date.now() - lastCoreWarningAt > 5 * 60 * 1000) {
    console.warn("[Core] Server catalog unavailable; using GameDig fallback:", error.code || "REQUEST_FAILED");
    lastCoreWarningAt = Date.now();
  }
}

async function check(client) {
  let results;
  try {
    const api = getCoreApiClient();
    if (api) {
      const catalog = await api.getServers();
      if (catalog.length) {
        results = catalog;
      }
    }
  } catch (error) {
    warnCore(error);
  }

  if (!results) {
    results = await Promise.all((config.gameServers || []).map(queryServer));
    if (!results.length) return;
    await reportCoreHeartbeats(results);
  }

  const channelId = config.channels?.serverStatus;
  if (!channelId) return;
  const channel = client.channels.cache.get(channelId);
  if (!channel) return;

  const lines = results.map((server) => server.online
    ? `:large_blue_circle: **${String(server.name).slice(0, 256)}** - ONLINE - ${server.players}/${server.maxPlayers} players${server.map ? ` - ${String(server.map).slice(0, 256)}` : ""}`
    : `:red_circle: **${String(server.name).slice(0, 256)}** - OFFLINE`);
  const text = lines.join("\n");
  const description = text.length > 4096 ? `${text.slice(0, 4093)}...` : text;
  const changeKey = JSON.stringify(results.map((server) => [
    server.id ?? null,
    server.name,
    server.online,
    server.players,
    server.maxPlayers,
    server.map ?? null,
  ]));
  if (changeKey === lastChangeKey) return;

  const embed = new EmbedBuilder()
    .setColor(config.colors.primary)
    .setTitle("SERVER STATUS UPDATE")
    .setDescription(description)
    .setTimestamp();
  await channel.send({ embeds: [embed] });
  lastChangeKey = changeKey;
}

async function reportCoreHeartbeats(results) {
  let api;
  try {
    api = getCoreApiClient();
  } catch (error) {
    warnCore(error);
    return;
  }
  if (!api) return;

  await Promise.all(results.filter((server) => server.coreServerId).map(async (server) => {
    const game = server.type === "7d2d" ? "7dtd"
      : server.type === "atlas" ? "atlas"
        : server.type === "ark" ? "ark" : null;
    if (!game) return;
    try {
      await api.sendServerHeartbeat(server.coreServerId, {
        game,
        serverVersion: server.serverVersion || "unknown",
        adapterVersion: process.env.CORE_API_ADAPTER_VERSION || "glitch-bot/1.0.0",
        online: server.online,
        playerCount: server.online ? server.players : 0,
        observedAt: new Date().toISOString(),
      });
    } catch (error) {
      warnCore(error);
    }
  }));
}

async function monitorLoop(client) {
  const runCheck = () => check(client).catch((error) => {
    console.error("[Server Status] Monitor cycle failed:", error.message);
  });
  await runCheck();
  setInterval(runCheck, 2 * 60 * 1000);
}

module.exports = { monitorLoop, getCoreGameKey: (type) => (
  type === "atlas" ? "atlas" : type === "7d2d" ? "7dtd" : type === "ark" ? "ark" : null
) };
