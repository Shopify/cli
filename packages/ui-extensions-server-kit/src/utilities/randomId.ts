/**
 * Generates a random identifier.
 * Uses `globalThis.crypto.randomUUID` to provide a cryptographically secure pseudo-random number generator (CSPRNG)
 * and prevent predictable IDs/token vulnerability, with a fallback to `Math.random()` for non-secure contexts.
 */
export function generateRandomId(): string {
  if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }
  return (Math.random() + 1).toString(36).substring(7)
}
