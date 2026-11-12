process.env.CORE_API_URL = "http://127.0.0.1:4100";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const coreApi = require("../src/services/coreApi");

test("Core server registry maps server status into Glitch display fields", async (t) => {
  const originalFetch = global.fetch;
  t.after(() => { global.fetch = originalFetch; });
  global.fetch = async (url, options) => {
    assert.equal(new URL(url).pathname, "/servers");
    assert.equal(options.method, "GET");
    return {
      ok: true,
      json: async () => ({
        data: [{
          id: "server-1",
          name: "ATLAS Main",
          gameKey: "atlas",
          online: true,
          playerCount: 7,
          maxPlayers: 40,
          mapName: "A1",
        }],
      }),
    };
  };

  const result = await coreApi.getCoreServers();
  assert.equal(result.configured, true);
  assert.equal(result.available, true);
  assert.deepEqual(result.servers, [{
    name: "ATLAS Main",
    game: "atlas",
    online: true,
    players: 7,
    maxPlayers: 40,
    map: "A1",
  }]);
});

test("Core registry reports unavailable for non-success responses", async (t) => {
  const originalFetch = global.fetch;
  t.after(() => { global.fetch = originalFetch; });
  global.fetch = async () => ({ ok: false, status: 503 });

  const result = await coreApi.getCoreServers();
  assert.equal(result.available, false);
  assert.deepEqual(result.servers, []);
});

test("Core registry rejects malformed response shapes", async (t) => {
  const originalFetch = global.fetch;
  t.after(() => { global.fetch = originalFetch; });
  global.fetch = async () => ({ ok: true, json: async () => ({ servers: [] }) });

  const result = await coreApi.getCoreServers();
  assert.equal(result.available, false);
  assert.deepEqual(result.servers, []);
});
