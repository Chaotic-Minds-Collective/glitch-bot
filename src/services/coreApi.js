const DEFAULT_TIMEOUT_MS = 5_000;

class CoreApiError extends Error {
  constructor(message, { status = 0, code = "CORE_API_ERROR" } = {}) {
    super(message);
    this.name = "CoreApiError";
    this.status = status;
    this.code = code;
  }
}

function createCoreApiClient({
  baseUrl = process.env.CORE_API_BASE_URL,
  serviceToken = process.env.CORE_API_SERVICE_TOKEN,
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  const configuredUrl = typeof baseUrl === "string" ? baseUrl.trim() : "";
  const token = typeof serviceToken === "string" ? serviceToken.trim() : "";
  if (!configuredUrl) return null;

  let origin;
  try {
    const parsed = new URL(configuredUrl);
    const localHttp = parsed.protocol === "http:"
      && ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
    if (parsed.protocol !== "https:" && !localHttp) {
      throw new Error("Core API URL must use HTTP or HTTPS outside loopback development.");
    }
    origin = parsed.origin;
  } catch (error) {
    throw new CoreApiError(error.message, { code: "INVALID_CORE_API_URL" });
  }

  async function request(path, { method = "GET", body, headers = {} } = {}) {
    if (!token) {
      throw new CoreApiError("Core API integration is not configured.", { code: "CORE_NOT_CONFIGURED" });
    }
    if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//")) {
      throw new CoreApiError("Core API path must be an absolute local path.", { code: "INVALID_PATH" });
    }
    const url = new URL(path, origin);
    if (url.origin !== origin) {
      throw new CoreApiError("Core API path escaped the configured origin.", { code: "INVALID_PATH" });
    }

    let response;
    try {
      response = await fetchImpl(url, {
        method,
        headers: {
          ...headers,
          Accept: "application/json",
          accept: "application/json",
          Authorization: `Bearer ${token}`,
          authorization: `Bearer ${token}`,
          ...(body === undefined ? {} : {
            "Content-Type": "application/json",
            "content-type": "application/json",
          }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw new CoreApiError("Core API request failed or timed out.", { code: "CORE_REQUEST_FAILED" });
    }

    const text = await response.text();
    let payload = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        if (response.ok) {
          throw new CoreApiError("Core API returned invalid JSON.", {
            status: response.status,
            code: "INVALID_CORE_RESPONSE",
          });
        }
      }
    }
    if (!response.ok) {
      throw new CoreApiError(payload?.error?.message || `Core API request failed (${response.status}).`, {
        status: response.status,
        code: payload?.error?.code || "CORE_REQUEST_FAILED",
      });
    }
    return payload;
  }

  async function getServers() {
    const payload = await request("/servers");
    if (!Array.isArray(payload?.data)) {
      throw new CoreApiError("Core API returned an invalid server catalog.", { code: "INVALID_SERVER_CATALOG" });
    }
    return payload.data.map((server) => ({
      id: server.id,
      name: server.name,
      game: server.gameKey,
      online: server.online === true,
      players: Number.isFinite(server.playerCount) ? server.playerCount : 0,
      maxPlayers: Number.isFinite(server.maxPlayers) ? server.maxPlayers : 0,
      map: server.mapName || null,
      host: server.publicHostname || null,
      port: server.gamePort || null,
      source: "core",
    }));
  }

  async function checkHealth() {
    try {
      const response = await fetchImpl(new URL("/health/live", origin), {
        method: "GET",
        headers: { Accept: "application/json", accept: "application/json" },
        signal: AbortSignal.timeout(timeoutMs),
      });
      return { configured: true, available: response.ok };
    } catch {
      return { configured: true, available: false };
    }
  }

  return Object.freeze({
    request,
    getServers,
    checkHealth,
    sendServerHeartbeat(serverId, heartbeat) {
      return request(`/integrations/servers/${encodeURIComponent(serverId)}/heartbeat`, {
        method: "POST",
        body: heartbeat,
      });
    },
  });
}

module.exports = { CoreApiError, createCoreApiClient };
