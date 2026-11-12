const CORE_API_URL = process.env.CORE_API_URL;

/**
 * Optional Core readiness check. Failure never prevents Glitch from starting.
 * The bot's community features remain independent from the Core service.
 */
async function checkCoreApi() {
  if (!CORE_API_URL) {
    console.info("[Core] Integration is not configured; Glitch will run independently.");
    return { configured: false, available: false };
  }

  let endpoint;
  try {
    endpoint = new URL("/health/ready", CORE_API_URL);
  } catch {
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

module.exports = { checkCoreApi };
