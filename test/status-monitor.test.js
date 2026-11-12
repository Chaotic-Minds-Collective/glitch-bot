const { test } = require("node:test");
const assert = require("node:assert/strict");

process.env.DISCORD_TOKEN = "test-token";
process.env.GUILD_ID = "test-guild";
process.env.CLIENT_ID = "test-client";
process.env.OWNER_ID = "test-owner";
process.env.CHANNEL_SERVER_STATUS = "test-status";
process.env.GAME_SERVERS = "[]";

const coreApi = require("../src/services/coreApi");

function setup(t, servers, send) {
  t.mock.method(coreApi, "getCoreServers", async () => ({ available: true, servers }));
  t.mock.method(global, "setInterval", () => 0);
  delete require.cache[require.resolve("../src/features/statusMonitor")];
  const { monitorLoop } = require("../src/features/statusMonitor");
  const cache = new Map([["test-status", { send }]]);
  return { poll: () => monitorLoop({ channels: { cache } }), cache };
}

function registry() {
  return Array.from({ length: 100 }, (_, i) => ({
    name: `${i}`.padEnd(32, "x"), online: false,
  }));
}

function description(payload) {
  assert.equal(payload.embeds.length, 1);
  const embed = payload.embeds[0].toJSON();
  assert.equal(embed.title, "SERVER STATUS UPDATE");
  assert.ok(embed.description.length > 0 && embed.description.length <= 4096);
  return embed.description;
}

test("large registries are sent intact in bounded messages and then suppressed", async (t) => {
  const servers = registry();
  const sent = [];
  const { poll } = setup(t, servers, async (payload) => sent.push(description(payload)));
  await poll();
  assert.ok(sent.length > 1);
  assert.equal(sent.join("\n"), servers.map((s) => `:red_circle: **${s.name}** - OFFLINE`).join("\n"));
  const count = sent.length;
  await poll();
  assert.equal(sent.length, count);
});

test("a single oversized line is split without losing text or breaking surrogate pairs", async (t) => {
  const name = "😀".repeat(5000);
  const sent = [];
  const { poll } = setup(t, [{ name, online: false }], async (payload) => sent.push(description(payload)));
  await poll();
  assert.equal(sent.join(""), `:red_circle: **${name}** - OFFLINE`);
  assert.ok(sent.every((part) => !/[\uD800-\uDBFF]$/.test(part) && !/^[\uDC00-\uDFFF]/.test(part)));
});

test("failure on a later message retries the update and only success suppresses it", async (t) => {
  let attempts = 0;
  const sent = [];
  const { poll } = setup(t, registry(), async (payload) => {
    attempts++;
    if (attempts === 2) throw new Error("simulated delivery failure");
    sent.push(description(payload));
  });
  await poll();
  assert.equal(attempts, 2);
  await poll();
  assert.equal(sent[0], sent[1]);
  const count = attempts;
  assert.ok(count > 2);
  await poll();
  assert.equal(attempts, count);
});

test("an unavailable channel leaves the update pending", async (t) => {
  const sent = [];
  const { poll, cache } = setup(t, [{ name: "Main", online: false }], async (payload) => sent.push(description(payload)));
  const channel = cache.get("test-status");
  cache.clear();
  await poll();
  cache.set("test-status", channel);
  await poll();
  assert.equal(sent.length, 1);
});

test("small online updates preserve game, player count and map", async (t) => {
  const sent = [];
  const { poll } = setup(t, [{ name: "Main", game: "atlas", online: true, players: 7, maxPlayers: 40, map: "A1" }],
    async (payload) => sent.push(description(payload)));
  await poll();
  assert.deepEqual(sent, [":large_blue_circle: **Main** [atlas] - ONLINE - 7/40 players - A1"]);
});
