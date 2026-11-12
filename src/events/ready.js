const coreApi = require("../services/coreApi");

module.exports = {
  name: "ready",
  /** Log startup, set Glitch's presence, and optionally probe Chaotic Gaming Core. */
  async execute(client) {
    console.log(`Glitch online as ${client.user.tag} - the chaos has structure.`);
    client.user.setPresence({
      activities: [{ name: "the static | chaoticmindsgaming.com", type: 3 }],
      status: "online",
    });
    await coreApi.checkCoreApi();
  },
};
