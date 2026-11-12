const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const configSource = fs.readFileSync(path.join(__dirname, '../src/config.js'), 'utf8');

function loadConfig(overrides = {}) {
  const module = { exports: {} };
  const env = {
    DISCORD_TOKEN: 'test-token',
    GUILD_ID: 'test-guild',
    CLIENT_ID: 'test-client',
    OWNER_ID: 'test-owner',
    ...overrides,
  };

  vm.runInNewContext(configSource, {
    module,
    process: { env },
    console: { warn() {} },
    require(id) {
      if (id === 'dotenv') return { config() {} };
      throw new Error(`Unexpected module dependency: ${id}`);
    },
  }, { filename: 'src/config.js' });

  return module.exports;
}

test('game server configuration defaults to an empty list', () => {
  const config = loadConfig();
  assert.equal(config.gameServers.length, 0);
});

test('valid game server entries are returned without normalizing field values', () => {
  const config = loadConfig({
    GAME_SERVERS: JSON.stringify([
      { name: 42, type: 'steam', host: '127.0.0.1', port: '27015' },
    ]),
  });

  assert.equal(config.gameServers.length, 1);
  assert.equal(config.gameServers[0].name, 42);
  assert.equal(config.gameServers[0].port, '27015');
  assert.equal(typeof config.gameServers[0].port, 'string');
});

test('valid Core server mapping and server version are accepted', () => {
  const config = loadConfig({
    GAME_SERVERS: JSON.stringify([{
      name: '7DTD test',
      type: '7d2d',
      host: '127.0.0.1',
      port: 26900,
      coreServerId: '123e4567-e89b-42d3-a456-426614174000',
      serverVersion: '2.5',
    }]),
  });
  assert.equal(config.gameServers[0].coreServerId, '123e4567-e89b-42d3-a456-426614174000');
});

test('invalid Core server mapping is rejected', () => {
  assert.throws(
    () => loadConfig({
      GAME_SERVERS: JSON.stringify([{
        name: 'Server', type: '7d2d', host: '127.0.0.1', port: 26900, coreServerId: 'not-a-uuid',
      }]),
    }),
    /coreServerId must be a valid UUID/,
  );
});

test('invalid JSON produces a configuration-specific error', () => {
  assert.throws(
    () => loadConfig({ GAME_SERVERS: '[not valid JSON' }),
    /GAME_SERVERS must contain valid JSON/,
  );
});

test('a non-array game server value is rejected', () => {
  assert.throws(
    () => loadConfig({ GAME_SERVERS: JSON.stringify({ name: 'Server' }) }),
    /GAME_SERVERS must be a JSON array/,
  );
});

test('game server entries require truthy name, type, host, and a valid integer port', () => {
  const invalidEntries = [
    { type: 'steam', host: '127.0.0.1', port: 27015 },
    { name: 'Server', host: '127.0.0.1', port: 27015 },
    { name: 'Server', type: 'steam', port: 27015 },
    { name: 'Server', type: 'steam', host: '127.0.0.1', port: 'not-a-port' },
    { name: 'Server', type: 'steam', host: '127.0.0.1', port: 27015.5 },
    { name: 'Server', type: 'steam', host: '127.0.0.1', port: 0 },
    { name: 'Server', type: 'steam', host: '127.0.0.1', port: -1 },
    { name: 'Server', type: 'steam', host: '127.0.0.1', port: 65536 },
    { name: 'Server', type: 'steam', host: '127.0.0.1', port: '' },
    { name: 'Server', type: 'steam', host: '127.0.0.1', port: ' 27015 ' },
    { name: 'Server', type: 'steam', host: '127.0.0.1', port: true },
    null,
    [],
  ];

  for (const entry of invalidEntries) {
    assert.throws(
      () => loadConfig({ GAME_SERVERS: JSON.stringify([entry]) }),
      /GAME_SERVERS entry 1 must include name, type, host, and an integer port from 1 to 65535/,
    );
  }
});

test('game server port boundaries 1 and 65535 are accepted', () => {
  const config = loadConfig({
    GAME_SERVERS: JSON.stringify([
      { name: 'Low', type: 'steam', host: '127.0.0.1', port: 1 },
      { name: 'High', type: 'steam', host: '127.0.0.1', port: 65535 },
    ]),
  });
  assert.equal(config.gameServers.length, 2);
});
