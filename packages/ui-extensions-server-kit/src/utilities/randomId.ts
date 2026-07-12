/**
 * Generates a random ID.
 *
 * @returns A random ID.
 */
export function generateRandomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return (Math.random() + 1).toString(36).substring(7)
}
