require('dotenv').config();

/**
 * Central configuration for Glitch, loaded from environment variables.
 * Secrets never live in code; channel/role IDs are wired via .env.
 */
module.exports = {
  token: process.env.DISCORD_TOKEN,
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
  gameServers: JSON.parse(process.env.GAME_SERVERS || '[]'),
  colors: { primary: 0x9b5cff, danger: 0xff3ddb, ok: 0x00e5ff },
};
