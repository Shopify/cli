import crypto from 'crypto'

/**
 * Generate a random string in Hex format of the provided size.
 *
 * @param size - Number of bytes to be generated.
 * @returns A random string in Hex format.
 */
export function randomHex(size: number): string {
  return crypto.randomBytes(size).toString('hex')
}

/**
 * Encode a string in Base64 valid for URLs.
 *
 * @param str - The string to encode.
 * @returns The encoded string.
 */
export function base64URLEncode(str: Buffer): string {
  return str.toString('base64url')
}

/**
 * Generate the SHA256 hash of a string.
 *
 * @param str - The string to hash.
 * @returns The SHA256 hash of the string.
 */
export function sha256(str: string): Buffer {
  return crypto.createHash('sha256').update(str).digest()
}

/**
 * Generate the SHA1 hash of a string.
 *
 * @param str - The string to hash.
 * @returns The SHA1 hash of the string.
 */
export function hashString(str: string): string {
  return crypto.createHash('sha1').update(str).digest('hex')
}

/**
 * Generate random data of the provided size.
 *
 * @param size - Number of bytes to be generated.
 * @returns A buffer of random data.
 */
export function randomBytes(size: number): Buffer {
  return crypto.randomBytes(size)
}

/**
 * Generate a random UUID string.
 *
 * @returns A random UUID string.
 */
export function randomUUID(): string {
  return crypto.randomUUID()
}
