import constants from '../../../constants.js'
import {firstPartyDev} from '../../../public/node/environment/local.js'
import {ExtendableError} from '../../../error.js'
import {randomUUID} from '../../../public/node/crypto.js'

export class RequestClientError extends ExtendableError {
  statusCode: number
  public constructor(message: string, statusCode: number) {
    super(message)
    this.statusCode = statusCode
  }
}

/**
 * Removes the sensitive data from the headers and outputs them as a string.
 * @param headers - HTTP headers.
 * @returns A sanitized version of the headers as a string.
 */
export function sanitizedHeadersOutput(headers: {[key: string]: string}): string {
  const sanitized: {[key: string]: string} = {}
  const keywords = ['token', 'authorization']
  Object.keys(headers).forEach((header) => {
    if (keywords.find((keyword) => header.toLocaleLowerCase().includes(keyword)) === undefined) {
      sanitized[header] = headers[header]!
    }
  })
  return Object.keys(sanitized)
    .map((header) => {
      return ` - ${header}: ${sanitized[header]}`
    })
    .join('\n')
}

export async function buildHeaders(token?: string): Promise<{[key: string]: string}> {
  const userAgent = `Shopify CLI; v=${await constants.versions.cliKit()}`

  const headers: {[header: string]: string} = {
    'User-Agent': userAgent,
    // 'Sec-CH-UA': secCHUA, This header requires the Git sha.
    'Sec-CH-UA-PLATFORM': process.platform,
    'X-Request-Id': randomUUID(),
    'Content-Type': 'application/json',
    ...(firstPartyDev() && {'X-Shopify-Cli-Employee': '1'}),
  }
  if (token) {
    // eslint-disable-next-line dot-notation
    headers['authorization'] = `Bearer ${token}`
    headers['X-Shopify-Access-Token'] = `Bearer ${token}`
  }

  return headers
}
