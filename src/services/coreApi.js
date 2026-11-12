const CORE_API_URL = process.env.CORE_API_URL;

function getCoreEndpoint(path) {
  try {
    return new URL(path, CORE_API_URL);
  } catch {
    return null;
  }
}

/**
 * Optional Core readiness check. Failure never prevents Glitch from starting.
 * The bot's community features remain independent from the Core service.
 */
async function checkCoreApi() {
  if (!CORE_API_URL) {
    console.info("[Core] Integration is not configured; Glitch will run independently.");
    return { configured: false, available: false };
  }
  const endpoint = getCoreEndpoint("/health/ready");
  if (!endpoint) {
    console.warn("[Core] CORE_API_URL is invalid; Core integration is disabled for this startup.");
    return { configured: true, available: false };
  }
  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) {
      console.warn(`[Core] Readiness check returned HTTP ${response.status}; Glitch remains operational.`);
      return { configured: true, available: false };
    }
    console.info("[Core] Readiness check passed; Core API and database are available.");
    return { configured: true, available: true };
  } catch (error) {
    console.warn(`[Core] Unavailable (${error.name || "connection error"}); Glitch remains operational.`);
    return { configured: true, available: false };
  }
}

/**
 * Read the Core server registry. Returns unavailable on any network or schema
 * error so the bot can fall back to its existing local GAME_SERVERS config.
 */
async function getCoreServers() {
  if (!CORE_API_URL) return { configured: false, available: false, servers: [] };
  const endpoint = getCoreEndpoint("/servers");
  if (!endpoint) return { configured: true, available: false, servers: [] };
  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return { configured: true, available: false, servers: [] };
    const payload = await response.json();
    if (!Array.isArray(payload?.data)) return { configured: true, available: false, servers: [] };
    const servers = payload.data
      .filter((server) => server && typeof server.name === "string" && typeof server.online === "boolean")
      .map((server) => ({
        name: server.name,
        game: server.gameKey,
        online: server.online,
        players: Number.isInteger(server.playerCount) ? server.playerCount : 0,
        maxPlayers: Number.isInteger(server.maxPlayers) ? server.maxPlayers : 0,
        map: typeof server.mapName === "string" ? server.mapName : null,
      }));
    return { configured: true, available: true, servers };
  } catch {
    return { configured: true, available: false, servers: [] };
  }
}

module.exports = { checkCoreApi, getCoreServers };
