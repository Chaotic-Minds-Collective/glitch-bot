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
  let origin = null;

  if (configuredUrl) {
    try {
      const parsed = new URL(configuredUrl);
      const localHttp = parsed.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsed.hostname);
      if (parsed.protocol !== "https:" && !localHttp) {
        throw new Error("Core API URL must use HTTPS outside localhost.");
      }
      origin = parsed.origin;
    } catch (error) {
      throw new CoreApiError(error.message, { code: "INVALID_CORE_API_URL" });
    }
  }

  async function request(path, { method = "GET", body, headers = {} } = {}) {
    if (!origin || !token) {
      throw new CoreApiError("Core API integration is not configured.", { code: "CORE_NOT_CONFIGURED" });
    }
    if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//")) {
      throw new CoreApiError("Core API path must be an absolute local path.", { code: "INVALID_PATH" });
    }

    const url = new URL(path, origin);
    const response = await fetchImpl(url, {
      method,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    const text = await response.text();
    let payload = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        throw new CoreApiError("Core API returned invalid JSON.", {
          status: response.status,
          code: "INVALID_CORE_RESPONSE",
        });
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

  return Object.freeze({
    request,
    sendServerHeartbeat(serverId, heartbeat) {
      return request(`/integrations/servers/${encodeURIComponent(serverId)}/heartbeat`, {
        method: "POST",
        body: heartbeat,
      });
    },
  });
}

module.exports = { CoreApiError, createCoreApiClient };
