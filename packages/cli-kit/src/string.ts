import {unstyled} from './output.js'
import crypto from 'crypto'

export {camelCase as camelize} from 'change-case'
export {paramCase as hyphenize} from 'change-case'
export {snakeCase as underscore} from 'change-case'
export {constantCase as constantize} from 'change-case'

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

export function hashString(str: string): string {
  return crypto.createHash('sha1').update(str).digest('hex')
}

/**
 * Given a string, it returns it with the first letter capitalized.
 * @param string - String whose first letter will be caplitalized.
 * @returns The given string with its first letter capitalized.
 */
export function capitalize(string: string) {
  return string.substring(0, 1).toUpperCase() + string.substring(1)
}

/**
 * Given a store, returns a valid store fqdn removing protocol and adding .myshopify.com domain
 * @param store - Original store name provided by the user
 * @returns a valid store fqdn
 */
export function normalizeStoreName(store: string) {
  const storeFqdn = store.replace(/^https?:\/\//, '').replace(/\/$/, '')
  return storeFqdn.includes('.myshopify.com') || storeFqdn.includes('spin.dev')
    ? storeFqdn
    : `${storeFqdn}.myshopify.com`
}

/**
 * Try to convert a string to an int, falling back to undefined if unable to
 */
export function tryParseInt(maybeInt: string | undefined) {
  let asInt: number | undefined
  if (maybeInt !== undefined) {
    asInt = parseInt(maybeInt, 10)
    if (isNaN(asInt)) {
      asInt = undefined
    }
  }
  return asInt
}

/**
 * Given a series of rows inside an array, where each row is an array of strings (representing columns)
 * Parse it into a single string with the columns aligned
 */
export function linesToColumns(lines: string[][]): string {
  const widths: number[] = []
  for (let i = 0; lines[0] && i < lines[0].length; i++) {
    const columnRows = lines.map((line) => line[i]!)
    widths.push(Math.max(...columnRows.map((row) => unstyled(row).length)))
  }
  const paddedLines = lines
    .map((line) => {
      return line
        .map((col, index) => {
          return `${col}${' '.repeat(widths[index]! - unstyled(col).length)}`
        })
        .join('   ')
        .trimEnd()
    })
    .join('\n')
  return paddedLines
}

export const slugify = (str: string) =>
  str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
