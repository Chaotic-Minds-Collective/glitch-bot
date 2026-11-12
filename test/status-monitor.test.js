const test = require('node:test');
const assert = require('node:assert/strict');

function harness(t, initialResults, { coreApiUrl = 'https://core.example.test', gameServers = [], gameDigResults = [] } = {}) {
  let results = initialResults;
  let cycle;
  let failure;
  let available = true;
  const sent = [];
  const queries = [];
  const configPath = require.resolve('../src/config');
  const corePath = require.resolve('../src/services/coreApi');
  const monitorPath = require.resolve('../src/features/statusMonitor');
  const queryPath = require.resolve('../src/features/serverQuery');
  const paths = [configPath, corePath, monitorPath, queryPath];
  const originals = paths.map((path) => require.cache[path]);
  require.cache[configPath] = { exports: {
    coreApiUrl,
    channels: { serverStatus: 'status' }, colors: { primary: 1 }, gameServers
  } };
  require.cache[corePath] = { exports: { createCoreApiClient: ({ baseUrl }) => baseUrl ? ({
    getServers: async () => {
      if (failure) throw failure;
      return results;
    }
  }) : null } };
  require.cache[queryPath] = { exports: { queryServer: async (cfg) => {
    queries.push(cfg);
    return gameDigResults.find((result) => result.id === cfg.id || result.name === cfg.name) || { ...cfg, online: false };
  } } };
  delete require.cache[monitorPath];
  t.mock.method(global, 'setInterval', (callback, delay) => {
    assert.equal(delay, 120000);
    cycle = callback;
  });
  t.mock.method(console, 'error', () => {});
  t.mock.method(console, 'warn', () => {});
  const channel = { send: async (message) => {
    // Serialize through the real Discord builder, including its validation.
    sent.push(message.embeds[0].toJSON());
  } };
  const client = { channels: { cache: { get: () => available ? channel : undefined } } };
  t.after(() => {
    paths.forEach((path, i) => {
      if (originals[i]) require.cache[path] = originals[i];
      else delete require.cache[path];
    });
  });
  return {
    start: () => require(monitorPath).monitorLoop(client),
    tick: () => cycle(), sent, channel, queries,
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

const localServers = [
  { name: 'Local Alpha', type: '7d2d', host: 'alpha.example.test', port: 26900 },
  { name: 'Local Beta', type: 'ark', host: 'beta.example.test', port: 27015 }
];

for (const scenario of ['unset URL', 'empty catalog']) {
  test(`${scenario} queries and publishes configured GameDig servers`, async (t) => {
    const h = harness(t, scenario === 'empty catalog' ? [] : [server], {
      coreApiUrl: scenario === 'unset URL' ? '' : 'https://core.example.test',
      gameServers: localServers
    });
    await h.start();
    assert.deepEqual(h.queries, localServers);
    assert.equal(h.sent.length, 1);
    assert.equal(h.sent[0].description,
      ':red_circle: **Local Alpha** - OFFLINE\n:red_circle: **Local Beta** - OFFLINE');

    if (scenario !== 'unset URL') {
      h.fail(null);
      h.results([server]);
      await h.tick();
      assert.deepEqual(h.queries, localServers);
      assert.equal(h.sent.length, 2);
      assert.match(h.sent[1].description, /Alpha.*ONLINE.*1\/10 players/);
      await h.tick();
      assert.equal(h.sent.length, 2);
    }
  });
}


test('Core failure falls back to GameDig results and the recurring cycle recovers', async (t) => {
  const gameServer = localServers[0];
  const gameDigResult = {
    ...gameServer, id: 'local-alpha', online: true, players: 3, maxPlayers: 20, map: 'The Island'
  };
  const h = harness(t, [server], {
    gameServers: [gameServer],
    gameDigResults: [gameDigResult]
  });
  h.fail(new Error('Core unavailable'));
  await h.start();
  assert.deepEqual(h.queries, [gameServer]);
  assert.equal(h.sent.length, 1);
  assert.match(h.sent[0].description, /Local Alpha.*ONLINE.*3\/20 players.*The Island/);

  h.fail(null);
  h.results([server]);
  await h.tick();
  assert.deepEqual(h.queries, [gameServer]);
  assert.equal(h.sent.length, 2);
  assert.match(h.sent[1].description, /Alpha.*ONLINE.*1\/10 players/);
  await h.tick();
  assert.equal(h.sent.length, 2);
});

test('a nonempty Core catalog takes precedence over configured GameDig servers', async (t) => {
  const h = harness(t, [server], { gameServers: localServers });
  await h.start();
  assert.deepEqual(h.queries, []);
  assert.equal(h.sent.length, 1);
  assert.match(h.sent[0].description, /Alpha.*ONLINE.*1\/10 players/);
});
