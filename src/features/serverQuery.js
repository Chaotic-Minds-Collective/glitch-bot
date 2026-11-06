const { GameDig } = require('gamedig');

/**
 * Queries one game server via gamedig. type uses gamedig game ids:
 * 7 Days to Die -> '7d2d', ARK Evolved -> 'ark', ARK Ascended -> 'arkSA', ATLAS -> 'atlas'.
 * Returns an online flag plus player/map info, or offline on failure.
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
