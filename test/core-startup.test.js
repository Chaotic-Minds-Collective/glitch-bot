const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");

test("disabled Core does not reject the startup ready handler", async () => {
  const ready = [];
  class Client {
    constructor() { this.commands = new Map(); }
    once(event, handler) { if (event === "ready") ready.push(handler); }
    on() {}
    login() {}
  }
  const discord = {
    Client, Collection: Map,
    GatewayIntentBits: {}, Partials: {},
  };
  vm.runInNewContext(fs.readFileSync(require.resolve("../src/index.js"), "utf8"), {
    require: (path) => {
      if (path === "discord.js") return discord;
      if (path === "./config") return { coreApi: {} };
      if (path === "./services/coreApi") return { createCoreApiClient: () => null };
      if (path === "./commands") return [];
      if (path === "./features/statusMonitor") return { monitorLoop() {} };
      if (path.startsWith("./events/")) return { execute() {} };
      throw new Error(`Unexpected dependency: ${path}`);
    },
  });
  assert.equal(ready.length, 3);
  for (const handler of ready) await handler();
});
