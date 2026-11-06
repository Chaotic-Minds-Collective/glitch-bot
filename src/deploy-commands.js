const { REST, Routes } = require('discord.js');
const config = require('./config');
const commands = require('./commands');

/**
 * Registers all slash commands as guild commands for the configured guild.
 * Run once via `npm run deploy` after any command changes.
 */
const rest = new REST().setToken(config.token);
(async () => {
  const body = commands.map((c) => c.data.toJSON());
  await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body });
  console.log(`Deployed ${body.length} slash commands to guild ${config.guildId}.`);
})();
