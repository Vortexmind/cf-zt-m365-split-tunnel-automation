import { Config } from "./config";

/**
 * Workers-runtime SubtleCrypto extension that includes timingSafeEqual.
 * The method exists at runtime but the built-in TypeScript lib types
 * do not include it, so we declare the extension here.
 */
interface WorkersSubtleCrypto extends SubtleCrypto {
  timingSafeEqual(
    a: ArrayBuffer | ArrayBufferView,
    b: ArrayBuffer | ArrayBufferView
  ): boolean;
}

/**
 * Validate the Authorization header against the configured webhook secret.
 * Uses constant-time comparison to prevent timing attacks.
 * Returns true if valid, false otherwise.
 *
 * Note: if the token and secret have different lengths, this returns false
 * immediately rather than padding to equal length. The secret length is a
 * config value, not truly secret, so the length leak is acceptable and the
 * simpler approach avoids unnecessary complexity.
 */
export function validateAuth(request: Request, config: Config): boolean {
  const header = request.headers.get("Authorization");
  if (!header) {
    return false;
  }

  const prefix = "Bearer ";
  if (!header.startsWith(prefix)) {
    return false;
  }

  const token = header.slice(prefix.length);
  if (token.length === 0) {
    return false;
  }

  const secret = config.webhookSecret;
  if (token.length !== secret.length) {
    // Length mismatch: return early. The secret length is not sensitive
    // (it is a config value), so this does not leak useful information.
    return false;
  }

  const tokenBytes = new TextEncoder().encode(token);
  const secretBytes = new TextEncoder().encode(secret);

  const subtle = crypto.subtle as WorkersSubtleCrypto;
  return subtle.timingSafeEqual(tokenBytes, secretBytes);
}
