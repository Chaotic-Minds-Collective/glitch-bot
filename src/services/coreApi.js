class CoreApiError extends Error {
  constructor(message, status = null) {
    super(message);
    this.name = 'CoreApiError';
    this.status = status;
  }
}

class CoreApiClient {
  constructor(config, fetchImpl = globalThis.fetch) {
    this.baseUrl = config.baseUrl ? new URL(config.baseUrl) : null;
    this.serviceToken = config.serviceToken || null;
    this.timeoutMs = config.timeoutMs || 5000;
    this.fetchImpl = fetchImpl;
  }

  get configured() {
    return Boolean(this.baseUrl);
  }

  async checkHealth() {
    if (!this.configured) return { configured: false, available: false };

    try {
      const response = await this.fetchImpl(new URL('/health/live', this.baseUrl), {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!response.ok) return { configured: true, available: false };
      return { configured: true, available: true };
    } catch {
      // Core availability must never prevent the independent Discord bot from starting.
      return { configured: true, available: false };
    }
  }

  async request(path, options = {}) {
    if (!this.configured) throw new CoreApiError('Chaotic Gaming Core is not configured.');
    if (!this.serviceToken) throw new CoreApiError('Core service credentials are not configured.');
    if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) {
      throw new CoreApiError('Core API paths must be absolute paths on the configured origin.');
    }

    const url = new URL(path, this.baseUrl);
    if (url.origin !== this.baseUrl.origin) {
      throw new CoreApiError('Core API path escaped the configured origin.');
    }

    const headers = new Headers(options.headers || {});
    headers.set('Accept', 'application/json');
    headers.set('Authorization', `Bearer ${this.serviceToken}`);

    let body;
    if (options.body !== undefined) {
      headers.set('Content-Type', 'application/json');
      body = JSON.stringify(options.body);
    }

    const timeout = AbortSignal.timeout(this.timeoutMs);
    const signal = options.signal ? AbortSignal.any([timeout, options.signal]) : timeout;

    let response;
    try {
      response = await this.fetchImpl(url, {
        method: options.method || 'GET',
        headers,
        ...(body === undefined ? {} : { body }),
        signal,
      });
    } catch {
      throw new CoreApiError('Chaotic Gaming Core request failed or timed out.');
    }

    if (!response.ok) {
      throw new CoreApiError(`Chaotic Gaming Core returned HTTP ${response.status}.`, response.status);
    }
    if (response.status === 204) return null;
    return response.json();
  }
}

module.exports = { CoreApiClient, CoreApiError };
