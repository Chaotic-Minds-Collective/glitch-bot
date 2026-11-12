const test = require("node:test");
const assert = require("node:assert/strict");
const { CoreApiError, createCoreApiClient } = require("../src/services/coreApi");

test("Core client fails closed when no service credential is configured", async () => {
  const client = createCoreApiClient({ baseUrl: "https://core.example.test", serviceToken: "" });
  await assert.rejects(
    client.request("/health/live"),
    (error) => error instanceof CoreApiError && error.code === "CORE_NOT_CONFIGURED"
  );
});

test("Core client sends authenticated heartbeat with JSON payload", async () => {
  let observed;
  const client = createCoreApiClient({
    baseUrl: "https://core.example.test/",
    serviceToken: "cg_srv_test-token",
    fetchImpl: async (url, options) => {
      observed = { url: String(url), options };
      return new Response(JSON.stringify({ data: { accepted: true } }), {
        status: 202,
        headers: { "content-type": "application/json" },
      });
    },
  });

  const result = await client.sendServerHeartbeat("server-123", {
    game: "7dtd",
    serverVersion: "test-build",
    adapterVersion: "0.1.0",
    online: true,
  });

  assert.equal(result.data.accepted, true);
  assert.equal(observed.url, "https://core.example.test/integrations/servers/server-123/heartbeat");
  assert.equal(observed.options.headers.Authorization, "Bearer cg_srv_test-token");
  assert.equal(JSON.parse(observed.options.body).game, "7dtd");
});

test("Core client rejects non-HTTPS remote endpoints", () => {
  assert.throws(
    () => createCoreApiClient({ baseUrl: "http://core.example.test", serviceToken: "token" }),
    (error) => error instanceof CoreApiError && error.code === "INVALID_CORE_API_URL"
  );
});

test("Core client rejects non-success responses without exposing credentials", async () => {
  const client = createCoreApiClient({
    baseUrl: "https://core.example.test",
    serviceToken: "secret-value",
    fetchImpl: async () => new Response(JSON.stringify({
      error: { code: "FORBIDDEN", message: "Not permitted" },
    }), { status: 403 }),
  });

  await assert.rejects(
    client.request("/private"),
    (error) => error.status === 403 && error.code === "FORBIDDEN" && !error.message.includes("secret-value")
  );
});

test("Core health check does not require a service credential and fails non-fatally", async () => {
  const client = createCoreApiClient({
    baseUrl: "https://core.example.test",
    serviceToken: "",
    fetchImpl: async () => new Response(null, { status: 200 }),
  });
  assert.deepEqual(await client.checkHealth(), { configured: true, available: true });
});

test("Core request cannot override its service bearer credential", async () => {
  let observedHeaders;
  const client = createCoreApiClient({
    baseUrl: "https://core.example.test",
    serviceToken: "trusted-token",
    fetchImpl: async (_url, options) => {
      observedHeaders = options.headers;
      return new Response(null, { status: 204 });
    },
  });
  await client.request("/private", { headers: { Authorization: "Bearer attacker-token" } });
  assert.equal(observedHeaders.Authorization, "Bearer trusted-token");
});


test("Core client accepts IPv6 loopback HTTP without allowing remote HTTP", async () => {
  let observedUrl;
  const client = createCoreApiClient({
    baseUrl: "http://[::1]:4100",
    serviceToken: "test-token",
    fetchImpl: async (url) => {
      observedUrl = String(url);
      return new Response(null, { status: 204 });
    },
  });
  await client.request("/private");
  assert.equal(observedUrl, "http://[::1]:4100/private");
  assert.deepEqual(await client.checkHealth(), { configured: true, available: true });
  assert.equal(observedUrl, "http://[::1]:4100/health/live");
  assert.throws(() => createCoreApiClient({ baseUrl: "http://[2001:db8::1]" }),
    (error) => error.code === "INVALID_CORE_API_URL");
});

test("Core client preserves HTTP failures for non-JSON responses", async () => {
  for (const status of [401, 403, 502]) {
    const client = createCoreApiClient({
      baseUrl: "https://core.example.test",
      serviceToken: "test-token",
      fetchImpl: async () => new Response("<html>upstream error</html>", { status }),
    });
    await assert.rejects(client.request("/private"), (error) =>
      error.status === status && error.code === "CORE_REQUEST_FAILED"
        && error.message === `Core API request failed (${status}).`);
  }
});

test("Core client still rejects invalid JSON in successful responses", async () => {
  const client = createCoreApiClient({
    baseUrl: "https://core.example.test",
    serviceToken: "test-token",
    fetchImpl: async () => new Response("not JSON", { status: 200 }),
  });
  await assert.rejects(client.request("/private"), (error) =>
    error.status === 200 && error.code === "INVALID_CORE_RESPONSE");
});
