require('dotenv').config();

function loadGameServers() {
  const raw = process.env.GAME_SERVERS || '[]';
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`GAME_SERVERS must contain valid JSON: ${error.message}`);
  }
  if (!Array.isArray(parsed)) throw new Error('GAME_SERVERS must be a JSON array.');
  for (const [index, server] of parsed.entries()) {
    if (!server || typeof server !== 'object' || !server.name || !server.type || !server.host || !Number.isInteger(Number(server.port))) {
      throw new Error(`GAME_SERVERS entry ${index + 1} must include name, type, host, and a numeric port.`);
    }
  }
  return parsed;
}

const config = {
  token: process.env.DISCORD_TOKEN,
  ownerId: process.env.OWNER_ID || null,
  guildId: process.env.GUILD_ID,
  clientId: process.env.CLIENT_ID,
  channels: {
    rules: process.env.CHANNEL_RULES,
    welcome: process.env.CHANNEL_WELCOME,
    announcements: process.env.CHANNEL_ANNOUNCEMENTS,
    joinLog: process.env.CHANNEL_JOIN_LOG,
    leaveLog: process.env.CHANNEL_LEAVE_LOG,
    serverStatus: process.env.CHANNEL_SERVER_STATUS,
    modLog: process.env.CHANNEL_MOD_LOG,
    tickets: process.env.CHANNEL_TICKETS,
    verify: process.env.CHANNEL_VERIFY,
  },
  roles: {
    member: process.env.ROLE_MEMBER,
    staff: process.env.ROLE_STAFF,
    moderator: process.env.ROLE_MODERATOR,
  },
  gameServers: loadGameServers(),
  colors: { primary: 0x9b5cff, danger: 0xff3ddb, ok: 0x00e5ff },
};

if (!config.token || config.token === 'paste-bot-token-here') {
  throw new Error('DISCORD_TOKEN is missing. Add the bot token to the local .env file.');
}
if (!config.guildId || !config.clientId) {
  throw new Error('GUILD_ID and CLIENT_ID must be configured in .env.');
}
if (!config.ownerId) {
  console.warn('[Security] OWNER_ID is not configured. Owner-only controls will remain unavailable.');
}

module.exports = config;
