const DEFAULT_TIMEOUT_MS = 5000;

/**
 * Create a read-only client for the public Chaotic Gaming Core server catalog.
 * Returns null when no Core URL is configured so the bot can keep using GameDig.
 */
function createCoreApiClient({ baseUrl, fetchImpl = fetch, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  if (!baseUrl) return null;

  const parsed = new URL(baseUrl);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("CORE_API_URL must use HTTP or HTTPS.");
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs < 500 || timeoutMs > 30000) {
    throw new Error("Core API timeout must be between 500 and 30000 milliseconds.");
  }

  const root = parsed.toString().replace(/\/+$/, "");

  return {
    async getServers() {
      const response = await fetchImpl(`${root}/servers`, {
        method: "GET",
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(timeoutMs)
      });

      if (!response.ok) {
        throw new Error(`Core API returned HTTP ${response.status}.`);
      }

      const body = await response.json();
      if (!body || !Array.isArray(body.data)) {
        throw new Error("Core API returned an invalid server catalog.");
      }

      return body.data.map((server) => {
        if (!server || typeof server.id !== "string" ||
            typeof server.name !== "string" || typeof server.online !== "boolean") {
          throw new Error("Core API server catalog contains an invalid server record.");
        }

        return {
          id: server.id,
          name: server.name,
          game: server.gameKey,
          online: server.online,
          players: Number.isInteger(server.playerCount) ? server.playerCount : 0,
          maxPlayers: Number.isInteger(server.maxPlayers) ? server.maxPlayers : 0,
          map: typeof server.mapName === "string" ? server.mapName : null,
          host: typeof server.publicHostname === "string" ? server.publicHostname : null,
          port: Number.isInteger(server.gamePort) ? server.gamePort : null,
          source: "core"
        };
      });
    }
  };
}

module.exports = { createCoreApiClient };
