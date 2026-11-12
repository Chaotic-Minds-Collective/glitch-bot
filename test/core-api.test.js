const { test } = require('node:test');
const assert = require('node:assert/strict');
const { CoreApiClient, CoreApiError } = require('../src/services/coreApi');

test('Core health check reports reachability without requiring a service token', async () => {
  let requestedUrl;
  const client = new CoreApiClient(
    { baseUrl: 'http://127.0.0.1:4100', timeoutMs: 500 },
    async (url) => {
      requestedUrl = String(url);
      return new Response(null, { status: 200 });
    },
  );

  const result = await client.checkHealth();
  assert.deepEqual(result, { configured: true, available: true });
  assert.equal(requestedUrl, 'http://127.0.0.1:4100/health/live');
});

test('Core health failure is non-fatal to Glitch', async () => {
  const client = new CoreApiClient(
    { baseUrl: 'http://127.0.0.1:4100', timeoutMs: 500 },
    async () => { throw new Error('connection refused'); },
  );

  assert.deepEqual(
    await client.checkHealth(),
    { configured: true, available: false },
  );
});

test('authenticated Core requests attach the service bearer token', async () => {
  let requestHeaders;
  const client = new CoreApiClient(
    { baseUrl: 'http://127.0.0.1:4100', serviceToken: 'test-secret', timeoutMs: 500 },
    async (_url, options) => {
      requestHeaders = new Headers(options.headers);
      return Response.json({ ok: true });
    },
  );

  assert.deepEqual(await client.request('/v1/bot/status'), { ok: true });
  assert.equal(requestHeaders.get('authorization'), 'Bearer test-secret');
});

test('authenticated Core requests require a service token', async () => {
  const client = new CoreApiClient(
    { baseUrl: 'http://127.0.0.1:4100', timeoutMs: 500 },
    async () => Response.json({ ok: true }),
  );

  await assert.rejects(
    () => client.request('/v1/bot/status'),
    (error) => error instanceof CoreApiError && /credentials/.test(error.message),
  );
});

test('Core requests reject paths that escape the configured origin', async () => {
  const client = new CoreApiClient(
    { baseUrl: 'https://core.example.test', serviceToken: 'test-secret' },
    async () => Response.json({ ok: true }),
  );

  await assert.rejects(() => client.request('//attacker.example/path'), CoreApiError);
  await assert.rejects(() => client.request('https://attacker.example/path'), CoreApiError);
});

test('unconfigured Core client remains disabled', async () => {
  const client = new CoreApiClient({});
  assert.deepEqual(
    await client.checkHealth(),
    { configured: false, available: false },
  );
});
