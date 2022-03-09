import crypto from 'crypto'

export {camelCase as camelize} from 'change-case'
export {paramCase as hyphenize} from 'change-case'

/** Returns a random string */
export function randomHex(size: number): string {
  return crypto.randomBytes(size).toString('hex')
}

export function generateRandomChallengePair() {
  const codeVerifier = base64URLEncode(crypto.randomBytes(32))
  const codeChallenge = base64URLEncode(sha256(codeVerifier))
  return {codeVerifier, codeChallenge}
}

function base64URLEncode(str: Buffer) {
  return str
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/[=]/g, '')
}

function sha256(str: string) {
  return crypto.createHash('sha256').update(str).digest()
}
