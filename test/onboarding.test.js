const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const discord = require('discord.js');
const { GuildMemberRoleManager, Collection } = discord;

function fixture(initial = ['verified', 'a'], options = {}) {
  const config = { roles: { member: 'verified', rulesAccepted: 'accepted', staff: 'staff' },
    gameRoles: [{ roleId: 'a', value: 'a', label: 'A' }, { roleId: 'b', value: 'b', label: 'B' }], channels: {}, colors: {} };
  const state = new Set(initial);
  const replies = [], writes = [];
  let deferred = false;
  const guild = { id: 'guild', roles: { resolveId: (role) => typeof role === 'string' ? role : role.id,
    fetch: async (id) => ({ id }) }, members: {} };
  const snapshot = () => {
    const cache = new Collection([...state].map((id) => [id, { id }]));
    const member = { _clone: () => ({}) };
    const manager = { guild, member, cache, client: { rest: {
      put: async (route) => {
        assert.ok(deferred, 'defer before REST');
        if (options.beforeWrite) await options.beforeWrite();
        const id = route.split('/').at(-1); writes.push(['put', id]); state.add(id);
      },
      delete: async (route) => {
        const id = route.split('/').at(-1); writes.push(['delete', id]);
        if (options.failRemove) throw new Error('synthetic removal failure');
        state.delete(id);
      },
    } } };
    member.roles = { cache, add: GuildMemberRoleManager.prototype.add.bind(manager), remove: GuildMemberRoleManager.prototype.remove.bind(manager) };
    return member;
  };
  guild.members.me = { permissions: { has: () => true }, roles: { highest: { comparePositionTo: () => 1 } } };
  guild.members.fetch = async (arg) => { assert.ok(deferred); assert.equal(arg.force, true); return snapshot(); };
  const interaction = { guild, user: { id: 'member' }, values: ['b'], inGuild: () => true,
    deferReply: async ({ flags }) => { assert.equal(flags, discord.MessageFlags.Ephemeral); deferred = true; },
    editReply: async (content) => { replies.push(content); },
  };
  const load = (name) => {
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(`src/features/${name}.js`, 'utf8'), {
      module, console: { error() {} }, require: (id) => id === 'discord.js' ? discord : id === '../config' ? config : {
        requireStaff: async () => true, replyEphemeral: async (_, text) => replies.push(text),
      },
    });
    return module.exports;
  };
  return { config, state, replies, writes, interaction, load, snapshot };
}

test('mixed replacement preserves unrelated concurrent role changes', async () => {
  const f = fixture(['verified', 'a', 'revoked'], { beforeWrite: async () => { f.state.delete('revoked'); f.state.add('concurrent'); } });
  await f.load('games').selectGames(f.interaction);
  assert.deepEqual([...f.state].sort(), ['b', 'concurrent', 'verified']);
  assert.deepEqual(f.writes, [['put', 'b'], ['delete', 'a']]);
  assert.match(f.replies.at(-1), /updated: B/);
});

test('clear removes game roles only', async () => {
  const f = fixture(['verified', 'a', 'b', 'unrelated']); f.interaction.values = ['none'];
  await f.load('games').selectGames(f.interaction);
  assert.deepEqual([...f.state].sort(), ['unrelated', 'verified']);
  assert.match(f.replies.at(-1), /cleared/);
});

test('partial failure reports observed state and releases the member guard', async () => {
  const f = fixture(undefined, { failRemove: true }); const games = f.load('games');
  await games.selectGames(f.interaction);
  assert.match(f.replies.at(-1), /incomplete.*A, B/);
  await games.selectGames(f.interaction);
  assert.doesNotMatch(f.replies.at(-1), /still being processed/);
});

test('overlapping selections are rejected while first selection finishes', async () => {
  let release, entered;
  const started = new Promise((r) => { entered = r; });
  const gate = new Promise((r) => { release = r; });
  const f = fixture(undefined, { beforeWrite: async () => { entered(); await gate; } }); const games = f.load('games');
  const first = games.selectGames(f.interaction); await started;
  await games.selectGames({ ...f.interaction, values: ['none'] });
  assert.match(f.replies.at(-1), /still being processed/);
  release(); await first;
  assert.deepEqual([...f.state].sort(), ['b', 'verified']);
});

test('invalid selections and protected/duplicate mappings never mutate roles; unverified selections only clean up', async () => {
  for (const kind of ['unknown', 'mixed', 'unverified', 'protected', 'duplicate']) {
    const f = fixture(kind === 'unverified' ? [] : undefined);
    if (kind === 'unknown') f.interaction.values = ['unknown'];
    if (kind === 'mixed') f.interaction.values = ['none', 'a'];
    if (kind === 'protected') f.config.gameRoles[0].roleId = 'staff';
    if (kind === 'duplicate') f.config.gameRoles[0].roleId = 'b';
    await f.load('games').selectGames(f.interaction);
    if (kind === 'unverified') assert.ok(f.writes.every(([method]) => method === 'delete'));
    else assert.equal(f.writes.length, 0, kind);
    assert.doesNotMatch(f.replies.at(-1), /undefined/);
  }
});

test('rules and verification directions fall back to channel names', async () => {
  const f = fixture(['accepted', 'verified']);
  f.interaction.guild.members.fetch = async () => f.snapshot();
  await f.load('rules').acceptRules(f.interaction);
  assert.match(f.replies.at(-1), /the verification channel/);
  await f.load('verify').verifyClaim(f.interaction);
  assert.match(f.replies.at(-1), /the game selection channel/);
  f.state.delete('accepted');
  await f.load('verify').verifyClaim(f.interaction);
  assert.match(f.replies.at(-1), /the rules channel/);
  assert.ok(f.replies.every((text) => !text.includes('undefined')));
});

test('unconfirmed or mismatched terminal state never reports success', async () => {
  for (const unavailable of [false, true]) {
    const f = fixture(); let fetches = 0;
    f.interaction.guild.members.fetch = async () => {
      if (++fetches > 1) {
        if (unavailable) throw new Error('synthetic fetch failure');
        f.state.delete('b');
      }
      return f.snapshot();
    };
    await f.load('games').selectGames(f.interaction);
    assert.match(f.replies.at(-1), /incomplete/);
    assert.doesNotMatch(f.replies.at(-1), /are updated/);
  }
});

test('missing role or insufficient bot hierarchy prevents writes', async () => {
  for (const missing of [false, true]) {
    const f = fixture();
    if (missing) f.interaction.guild.roles.fetch = async () => null;
    else f.interaction.guild.members.me.roles.highest.comparePositionTo = () => 0;
    await f.load('games').selectGames(f.interaction);
    assert.equal(f.writes.length, 0);
  }
});

test('panel payloads contain readable rules text and a valid verification emoji', async () => {
  const f = fixture();
  f.config.colors.primary = 0x123456;
  f.config.channels.rules = 'rules';
  f.config.channels.verify = 'verify';
  const sent = [];
  f.interaction.guild.channels = { fetch: async (id) => ({
    id, isTextBased: () => true, send: async (payload) => sent.push(payload),
  }) };
  await f.load('rules').rulesPanel(f.interaction);
  await f.load('verify').verifyPanel(f.interaction);
  assert.equal(sent[0].embeds[0].toJSON().footer.text, 'Chaotic Gaming • Community built by gamers, for gamers.');
  assert.equal(sent[0].components[0].toJSON().components[0].label, 'I AGREE — ACCEPT RULES');
  assert.equal(sent[1].components[0].toJSON().components[0].emoji.name, '🧠');
});


test('revocation during a grant clears game roles and preserves unrelated roles', async () => {
  const f = fixture(['verified', 'a', 'unrelated'], { beforeWrite: async () => { f.state.delete('verified'); } });
  await f.load('games').selectGames(f.interaction);
  assert.deepEqual([...f.state], ['unrelated']);
  assert.match(f.replies.at(-1), /verify.*before choosing games/);
  assert.doesNotMatch(f.replies.at(-1), /are updated/);
});

test('revocation during validation prevents grants', async () => {
  const f = fixture();
  f.interaction.guild.roles.fetch = async (id) => { f.state.delete('verified'); return { id }; };
  await f.load('games').selectGames(f.interaction);
  assert.equal(f.writes.filter(([method]) => method === 'put').length, 0);
  assert.equal(f.state.size, 0);
});

test('failed eligibility cleanup is reported and retried on the next selection', async () => {
  const options = { failRemove: true, beforeWrite: async () => { f.state.delete('verified'); } };
  const f = fixture(undefined, options);
  const games = f.load('games');
  await games.selectGames(f.interaction);
  assert.match(f.replies.at(-1), /cleanup could not be confirmed.*try again or contact staff/);
  assert.ok(f.state.has('b'));
  options.failRemove = false;
  await games.selectGames(f.interaction);
  assert.equal(f.state.size, 0);
  assert.match(f.replies.at(-1), /cleared/);
});


test('revocation between multiple grants stops further grants and reconciles all game roles', async () => {
  const f = fixture(['verified', 'unrelated'], { beforeWrite: async () => { f.state.delete('verified'); } });
  f.interaction.values = ['a', 'b'];
  await f.load('games').selectGames(f.interaction);
  assert.deepEqual(f.writes.filter(([method]) => method === 'put'), [['put', 'a']]);
  assert.deepEqual([...f.state], ['unrelated']);
  assert.doesNotMatch(f.replies.at(-1), /are updated/);
});


test('terminal eligibility check clears roles when no additions were needed', async () => {
  const f = fixture(['verified', 'b', 'unrelated']);
  let fetches = 0;
  f.interaction.guild.members.fetch = async () => {
    if (++fetches === 2) f.state.delete('verified');
    return f.snapshot();
  };
  await f.load('games').selectGames(f.interaction);
  assert.deepEqual([...f.state], ['unrelated']);
  assert.match(f.replies.at(-1), /verify.*before choosing games/);
});
