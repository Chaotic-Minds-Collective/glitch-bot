const test = require('node:test');
const assert = require('node:assert/strict');

function harness(t, initialResults) {
  let results = initialResults;
  let cycle;
  let failure;
  let available = true;
  const sent = [];
  const configPath = require.resolve('../src/config');
  const corePath = require.resolve('../src/services/coreApi');
  const monitorPath = require.resolve('../src/features/statusMonitor');
  const originals = [configPath, corePath, monitorPath].map((path) => require.cache[path]);
  require.cache[configPath] = { exports: {
    coreApiUrl: 'https://core.example.test',
    channels: { serverStatus: 'status' }, colors: { primary: 1 }, gameServers: []
  } };
  require.cache[corePath] = { exports: { createCoreApiClient: () => ({
    getServers: async () => {
      if (failure) throw failure;
      return results;
    }
  }) } };
  delete require.cache[monitorPath];
  t.mock.method(global, 'setInterval', (callback, delay) => {
    assert.equal(delay, 120000);
    cycle = callback;
  });
  t.mock.method(console, 'error', () => {});
  t.mock.method(console, 'warn', () => {});
  const channel = { send: async (message) => {
    if (failure) throw failure;
    // Serialize through the real Discord builder, including its validation.
    sent.push(message.embeds[0].toJSON());
  } };
  const client = { channels: { cache: { get: () => available ? channel : undefined } } };
  t.after(() => {
    [configPath, corePath, monitorPath].forEach((path, i) => {
      if (originals[i]) require.cache[path] = originals[i];
      else delete require.cache[path];
    });
  });
  return {
    start: () => require(monitorPath).monitorLoop(client),
    tick: () => cycle(), sent, channel,
    results: (value) => { results = value; },
    fail: (value) => { failure = value; },
    available: (value) => { available = value; }
  };
}

const server = { id: 'one', name: 'Alpha', online: true, players: 1, maxPlayers: 10, map: 'Map' };

test('publishes display changes and suppresses unchanged results', async (t) => {
  const h = harness(t, [server]);
  await h.start();
  await h.tick();
  assert.equal(h.sent.length, 1);
  for (const patch of [{ name: 'Beta' }, { maxPlayers: 20 }, { map: 'New map' }]) {
    h.results([{ ...server, ...patch }]);
    await h.tick();
  }
  assert.equal(h.sent.length, 4);
  assert.match(h.sent[1].description, /Beta/);
});

test('oversized names, maps and catalogs serialize within Discord limits', async (t) => {
  const h = harness(t, Array.from({ length: 100 }, (_, i) => ({
    ...server, id: String(i), name: 'N'.repeat(5000), map: 'M'.repeat(5000), online: i % 2 === 0
  })));
  await h.start();
  assert.equal(h.sent.length, 1);
  assert.ok(h.sent[0].description.length <= 4096);
  assert.ok(h.sent[0].description.endsWith('...'));
  h.results([{ ...server, name: 'Corrected' }]);
  await h.tick();
  assert.equal(h.sent.length, 2);
});

test('failed first delivery schedules retries and commits state only after success', async (t) => {
  const h = harness(t, [server]);
  const send = h.channel.send;
  h.channel.send = async () => { throw new Error('send unavailable'); };
  await h.start();
  h.channel.send = send;
  await h.tick();
  await h.tick();
  assert.equal(h.sent.length, 1);
});

test('a missing channel does not suppress later publication', async (t) => {
  const h = harness(t, [server]);
  h.available(false);
  await h.start();
  h.available(true);
  await h.tick();
  assert.equal(h.sent.length, 1);
});

test('Core failure falls back and the recurring cycle recovers', async (t) => {
  const h = harness(t, [server]);
  h.fail(new Error('Core unavailable'));
  await h.start();
  h.fail(null);
  await h.tick();
  assert.equal(h.sent.length, 1);
});
