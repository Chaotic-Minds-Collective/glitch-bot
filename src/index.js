const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
const config = require('./config');
const { CoreApiClient } = require('./services/coreApi');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildModeration,
  ],
  partials: [Partials.Channel, Partials.Message],
});

client.commands = new Collection();
const commands = require('./commands');
for (const cmd of commands) client.commands.set(cmd.data.name, cmd);

const events = {
  ready: require('./events/ready'),
  interactionCreate: require('./events/interactionCreate'),
  guildMemberAdd: require('./events/guildMemberAdd'),
  guildMemberRemove: require('./events/guildMemberRemove'),
};

client.once('ready', () => events.ready.execute(client));
client.on('interactionCreate', (i) => events.interactionCreate.execute(client, i));
client.on('guildMemberAdd', (m) => events.guildMemberAdd.execute(client, m));
client.on('guildMemberRemove', (m) => events.guildMemberRemove.execute(client, m));

// Optional Core health integration. A Core outage must not take Glitch offline.
const coreApi = new CoreApiClient(config.coreApi);
client.once('ready', async () => {
  const result = await coreApi.checkHealth();
  if (!result.configured) return;
  if (result.available) console.info('[Core] Chaotic Gaming Core is reachable.');
  else console.warn('[Core] Chaotic Gaming Core is unavailable; independent bot features remain active.');
});

// Status monitor: check game servers every 2 minutes
const { monitorLoop } = require('./features/statusMonitor');
client.once('ready', () => monitorLoop(client));

client.login(config.token);
