import {isShopify} from '../environment/local.js'
import constants from '../constants.js'
import {randomUUID} from 'crypto'

export async function buildHeaders(token: string): Promise<{[key: string]: string}> {
  const userAgent = `Shopify CLI; v=${await constants.versions.cliKit()}`
  const isEmployee = await isShopify()

  const headers = {
    /* eslint-disable @typescript-eslint/naming-convention */
    'User-Agent': userAgent,
    // 'Sec-CH-UA': secCHUA, This header requires the Git sha.
    'Sec-CH-UA-PLATFORM': process.platform,
    'X-Request-Id': randomUUID(),
    authorization: `Bearer ${token}`,
    'X-Shopify-Access-Token': `Bearer ${token}`,
    'Content-Type': 'application/json',
    // ...(isEmployee && {'X-Shopify-Cli-Employee': '1'}),
    /* eslint-enable @typescript-eslint/naming-convention */
  }

  return headers
}

/**
 * Remvoes the sensitive data from the headers and outputs them as a string.
 * @param headers {{[key: string]: string}} HTTP headers.
 * @returns {string} A sanitized version of the headers as a string.
 */
export function sanitizedHeadersOutput(headers: {[key: string]: string}): string {
  const sanitized: {[key: string]: string} = {}
  const keywords = ['token', 'authorization']
  Object.keys(headers).forEach((header) => {
    if (keywords.find((keyword) => header.toLocaleLowerCase().includes(keyword)) === undefined) {
      sanitized[header] = headers[header]
    }
  })
  return Object.keys(sanitized)
    .map((header) => {
      return ` - ${header}: ${sanitized[header]}`
    })
    .join('\n')
}
