const test = require("node:test");
const assert = require("node:assert/strict");
const { createCoreApiClient } = require("../src/services/coreApi");

const jsonResponse = (payload, options = {}) => ({
  ok: options.ok ?? true,
  status: options.status ?? 200,
  text: async () => JSON.stringify(payload),
});

test("Core API client maps the canonical server catalog", async () => {
  let requestedUrl;
  const client = createCoreApiClient({
    baseUrl: "https://core.example.test/",
    serviceToken: "test-token",
    fetchImpl: async (url, options) => {
      requestedUrl = String(url);
      assert.equal(options.method, "GET");
      assert.equal(options.headers.accept, "application/json");
      assert.equal(options.headers.authorization, "Bearer test-token");
      return jsonResponse({ data: [{
        id: "server-1", name: "7DTD Main", gameKey: "7dtd", online: true,
        playerCount: 8, maxPlayers: 40, mapName: "Navezgane",
        publicHostname: "play.example.test", gamePort: 26900,
      }] });
    },
  });
  const servers = await client.getServers();
  assert.equal(requestedUrl, "https://core.example.test/servers");
  assert.deepEqual(servers[0], {
    id: "server-1", name: "7DTD Main", game: "7dtd", online: true,
    players: 8, maxPlayers: 40, map: "Navezgane", host: "play.example.test",
    port: 26900, source: "core",
  });
});

test("Core API client rejects non-success responses", async () => {
  const client = createCoreApiClient({
    baseUrl: "https://core.example.test", serviceToken: "test-token",
    fetchImpl: async () => jsonResponse({ error: { message: "Unavailable" } }, { ok: false, status: 503 }),
  });
  await assert.rejects(client.getServers(), /Unavailable/);
});

test("Core API client rejects malformed payloads", async () => {
  const client = createCoreApiClient({
    baseUrl: "https://core.example.test", serviceToken: "test-token",
    fetchImpl: async () => jsonResponse({ data: {} }),
  });
  await assert.rejects(client.getServers(), /invalid server catalog/);
});

test("Core API client is disabled when no URL is configured", () => {
  assert.equal(createCoreApiClient({ baseUrl: null }), null);
});

test("Core API URL rejects unsupported protocols", () => {
  assert.throws(() => createCoreApiClient({
    baseUrl: "file:///tmp/core", serviceToken: "test-token",
  }), /HTTP or HTTPS/);
});

test("Core catalog GET works without a token and strips caller credentials", async () => {
  const client = createCoreApiClient({
    baseUrl: "https://core.example.test", serviceToken: "",
    fetchImpl: async (_url, options) => {
      assert.equal(new Headers(options.headers).has("authorization"), false);
      return jsonResponse({ data: [] });
    },
  });
  assert.deepEqual(await client.getServers(), []);
  await client.request("/servers", { headers: { AUTHORIZATION: "Bearer caller" } });
});

test("Core catalog rejects invalid identity and status rather than inventing offline status", async () => {
  const valid = { id: "one", name: "Alpha", online: false };
  for (const entry of [null, {}, { ...valid, online: undefined }, { ...valid, online: "false" },
    { ...valid, id: "" }, { ...valid, name: 1 }]) {
    const client = createCoreApiClient({
      baseUrl: "https://core.example.test", serviceToken: "",
      fetchImpl: async () => jsonResponse({ data: [valid, entry] }),
    });
    await assert.rejects(client.getServers(), { code: "INVALID_SERVER_CATALOG" });
  }
});
