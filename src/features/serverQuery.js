const { GameDig } = require('gamedig');

/**
 * Query a game server. type uses gamedig's game ids:
 * 7days -> '7d2d', ARK Evolved -> 'ark', ARK Ascended -> 'arkSA', ATLAS -> 'atlas'
 * @param {{name: string, type: string, host: string, port: number}} cfg - server connection config
 * @returns {Promise<object>} server status with online flag, player count and map when online
 */
async function queryServer(cfg) {
  try {
    const state = await GameDig.query({ type: cfg.type, host: cfg.host, port: cfg.port, maxAttempts: 2 });
    return { ...cfg, online: true, players: state.players.length, maxPlayers: state.maxplayers, map: state.map };
  } catch {
    return { ...cfg, online: false };
  }
}

module.exports = { queryServer };
