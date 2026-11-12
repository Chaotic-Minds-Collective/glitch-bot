const { EmbedBuilder } = require("discord.js");
const { queryServer } = require("./serverQuery");
const config = require("../config");
const coreApi = require("../services/coreApi");

// Every 2 minutes: use Core's shared server registry when available, otherwise
// preserve the existing local GAME_SERVERS/Gamedig monitoring behavior.
const state = new Map();

async function getStatusResults() {
  const core = await coreApi.getCoreServers();
  if (core.available) return core.servers;
  if (!config.gameServers.length) return [];
  return Promise.all(config.gameServers.map(queryServer));
}

/**
 * Poll configured game servers and post an embed only when status changes.
 * @param {import("discord.js").Client} client
 */
async function check(client) {
  if (!config.channels.serverStatus) return;
  const results = await getStatusResults();
  if (!results.length) return;

  const key = results
    .map((server) => [
      server.name,
      server.game || "",
      server.online ? "online" : "offline",
      server.players ?? 0,
      server.maxPlayers ?? 0,
      server.map || "",
    ].join(":"))
    .sort()
    .join("|");
  if (state.has(key)) return;
  state.clear();
  state.set(key, true);

  const channel = client.channels.cache.get(config.channels.serverStatus);
  if (!channel) return;
  const lines = results.map((server) => {
    const game = server.game ? ` [${server.game}]` : "";
    return server.online
      ? `:large_blue_circle: **${server.name}**${game} - ONLINE - ${server.players}/${server.maxPlayers} players${server.map ? ` - ${server.map}` : ""}`
      : `:red_circle: **${server.name}**${game} - OFFLINE`;
  });
  const embed = new EmbedBuilder()
    .setColor(config.colors.primary)
    .setTitle("SERVER STATUS UPDATE")
    .setDescription(lines.join("\n"))
    .setTimestamp();
  await channel.send({ embeds: [embed] }).catch(() => {});
}

/**
 * Start the recurring status monitor loop (first check + every 2 minutes).
 * @param {import("discord.js").Client} client
 */
async function monitorLoop(client) {
  await check(client);
  setInterval(() => void check(client), 2 * 60 * 1000);
}

module.exports = { monitorLoop };
