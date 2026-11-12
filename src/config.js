require('dotenv').config();

/**
 * Parse and validate configured game-server entries.
 * @returns {Array<{name: *, type: *, host: *, port: *}>} Valid entries, preserving field values.
 * @throws {Error} If GAME_SERVERS is invalid JSON, is not an array, or contains an invalid entry.
 */
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
    const portIsNumeric = typeof server?.port === 'number'
      || (typeof server?.port === 'string' && /^\d+$/.test(server.port));
    const port = portIsNumeric ? Number(server.port) : NaN;
    const validPort = Number.isInteger(port) && port >= 1 && port <= 65535;
    if (!server || typeof server !== 'object' || Array.isArray(server)
      || !server.name || !server.type || !server.host || !validPort) {
      throw new Error(`GAME_SERVERS entry ${index + 1} must include name, type, host, and an integer port from 1 to 65535.`);
    }
    if (server.coreServerId !== undefined
      && (typeof server.coreServerId !== 'string'
        || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(server.coreServerId))) {
      throw new Error(`GAME_SERVERS entry ${index + 1} coreServerId must be a valid UUID when provided.`);
    }
    if (server.serverVersion !== undefined
      && (typeof server.serverVersion !== 'string' || !server.serverVersion.trim() || server.serverVersion.length > 100)) {
      throw new Error(`GAME_SERVERS entry ${index + 1} serverVersion must be a non-empty string of at most 100 characters.`);
    }
  }
  return parsed;
}

const coreApiBaseUrl = process.env.CORE_API_BASE_URL || null;
const coreApiServiceToken = process.env.CORE_API_SERVICE_TOKEN || null;
if (coreApiServiceToken && !coreApiBaseUrl) {
  throw new Error('CORE_API_BASE_URL is required when CORE_API_SERVICE_TOKEN is configured.');
}
if (coreApiBaseUrl) {
  let parsedCoreApiUrl;
  try {
    parsedCoreApiUrl = new URL(coreApiBaseUrl);
  } catch {
    throw new Error('CORE_API_BASE_URL must be a valid absolute URL.');
  }
  if (!['http:', 'https:'].includes(parsedCoreApiUrl.protocol)) {
    throw new Error('CORE_API_BASE_URL must use HTTP or HTTPS.');
  }
  const localHosts = ['localhost', '127.0.0.1', '[::1]'];
  if (coreApiServiceToken && parsedCoreApiUrl.protocol !== 'https:'
    && !localHosts.includes(parsedCoreApiUrl.hostname)) {
    throw new Error('CORE_API_SERVICE_TOKEN requires HTTPS except for loopback development URLs.');
  }
}

const config = {
  token: process.env.DISCORD_TOKEN,
  ownerId: process.env.OWNER_ID || null,
  guildId: process.env.GUILD_ID,
  clientId: process.env.CLIENT_ID,
  coreApi: {
    baseUrl: coreApiBaseUrl,
    serviceToken: coreApiServiceToken,
    timeoutMs: 5000,
  },
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
    pickYourWorld: process.env.CHANNEL_PICK_YOUR_WORLD,
    introduceYourself: process.env.CHANNEL_INTRODUCE_YOURSELF,
  },
  roles: {
    member: process.env.ROLE_MEMBER,
    staff: process.env.ROLE_STAFF,
    moderator: process.env.ROLE_MODERATOR,
    rulesAccepted: process.env.ROLE_RULES_ACCEPTED,
  },
  gameRoles: [
    { value: '7dtd', label: '7 Days to Die', roleId: process.env.ROLE_GAME_7DTD },
    { value: 'atlas', label: 'ATLAS', roleId: process.env.ROLE_GAME_ATLAS },
    { value: 'ark_evolved', label: 'ARK: Survival Evolved', roleId: process.env.ROLE_GAME_ARK_EVOLVED },
    { value: 'ark_ascended', label: 'ARK: Survival Ascended', roleId: process.env.ROLE_GAME_ARK_ASCENDED },
  ],
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
