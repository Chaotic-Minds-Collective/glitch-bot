const { EmbedBuilder } = require("discord.js");
const { queryServer } = require("./serverQuery");
const config = require("../config");
const coreApi = require("../services/coreApi");

const state = new Map();

async function getStatusResults() {
  const core = await coreApi.getCoreServers();
  if (core.available && core.servers.length > 0) return core.servers;
  if (!config.gameServers.length) return [];
  return Promise.all(config.gameServers.map(queryServer));
}

async function check(client) {
  if (!config.channels.serverStatus) return;
  const results = await getStatusResults();
  if (!results.length) return;

  const key = results
    .map((server) => [
      server.name, server.game || "", server.online ? "online" : "offline",
      server.players ?? 0, server.maxPlayers ?? 0, server.map || "",
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

async function monitorLoop(client) {
  await check(client);
  setInterval(() => void check(client), 2 * 60 * 1000);
}

module.exports = { monitorLoop };
