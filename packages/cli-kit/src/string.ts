import crypto from 'crypto'

export {camelCase as camelize} from 'change-case'
export {paramCase as hyphenize} from 'change-case'
export {snakeCase as underscore} from 'change-case'

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
  return str.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/[=]/g, '')
}

function sha256(str: string) {
  return crypto.createHash('sha256').update(str).digest()
}

/**
 * Given a string, it returns it with the first letter capitalized.
 * @param string {string} String whose first letter will be caplitalized.
 * @returns The given string with its first letter capitalized.
 */
export function capitalize(string: string) {
  return string.substring(0, 1).toUpperCase() + string.substring(1)
}
