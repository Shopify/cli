import crypto from 'crypto'

/** Returns a random string */
export function randomHex(size: number): string {
  return crypto.randomBytes(size).toString('hex')
}

export function base64URLEncode(str: Buffer): string {
  return str.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/[=]/g, '')
}

export function sha256(str: string): Buffer {
  return crypto.createHash('sha256').update(str).digest()
}

export function hashString(str: string): string {
  return crypto.createHash('sha1').update(str).digest('hex')
}

export function randomBytes(size: number): Buffer {
  return crypto.randomBytes(size)
}
