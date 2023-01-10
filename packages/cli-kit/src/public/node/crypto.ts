import crypto from 'crypto'

/**
 * Generate a random string in Hex format of the provided size
 */
export function randomHex(size: number): string {
  return crypto.randomBytes(size).toString('hex')
}

/**
 * Encode a string in Base64 valid for URLs
 */
export function base64URLEncode(str: Buffer): string {
  return str.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/[=]/g, '')
}

/**
 * Generate the SHA256 hash of a string
 */
export function sha256(str: string): Buffer {
  return crypto.createHash('sha256').update(str).digest()
}

/**
 * Generate the SHA1 hash of a string
 */
export function hashString(str: string): string {
  return crypto.createHash('sha1').update(str).digest('hex')
}

/**
 * Generate random data of the provided size (in bytes)
 */
export function randomBytes(size: number): Buffer {
  return crypto.randomBytes(size)
}

/**
 * Generate a random UUID string
 */
export function randomUUID(): string {
  return crypto.randomUUID()
}
