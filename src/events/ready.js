module.exports = {
  name: 'ready',
  /** Log startup and set Glitch's presence. */
  async execute(client) {
    console.log(`Glitch online as ${client.user.tag} - the chaos has structure.`);
    client.user.setPresence({
      activities: [{ name: 'the static | chaoticmindsgaming.com', type: 3 }],
      status: 'online',
    });
  },
};
