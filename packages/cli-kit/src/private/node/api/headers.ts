import {CLI_KIT_VERSION} from '../../../public/common/version.js'
import {firstPartyDev} from '../../../public/node/context/local.js'
import {AbortError} from '../../../public/node/error.js'
import https from 'https'

class RequestClientError extends AbortError {
  statusCode: number
  public constructor(message: string, statusCode: number) {
    const tryMessage =
      statusCode === 403
        ? 'Ensure you are using the correct account. You can switch with `shopify auth login`'
        : undefined
    super(message, tryMessage)
    this.statusCode = statusCode
  }
}
export class GraphQLClientError extends RequestClientError {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  errors?: any[]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public constructor(message: string, statusCode: number, errors?: any[]) {
    super(message, statusCode)
    this.errors = errors
    this.stack = undefined
  }
}

/**
 * Removes the sensitive data from the headers and outputs them as a string.
 * @param headers - HTTP headers.
 * @returns A sanitized version of the headers as a string.
 */
export function sanitizedHeadersOutput(headers: {[key: string]: string}): string {
  const sanitized: {[key: string]: string} = {}
  const keywords = ['token', 'authorization', 'subject_token']
  Object.keys(headers).forEach((header) => {
    if (keywords.find((keyword) => header.toLocaleLowerCase().includes(keyword)) === undefined) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      sanitized[header] = headers[header]!
    }
  })
  return Object.keys(sanitized)
    .map((header) => {
      return ` - ${header}: ${sanitized[header]}`
    })
    .join('\n')
}

export function buildHeaders(token?: string): {[key: string]: string} {
  const userAgent = `Shopify CLI; v=${CLI_KIT_VERSION}`

  const headers: {[header: string]: string} = {
    'User-Agent': userAgent,
    'Keep-Alive': 'timeout=30',
    // 'Sec-CH-UA': secCHUA, This header requires the Git sha.
    'Sec-CH-UA-PLATFORM': process.platform,
    'Content-Type': 'application/json',
    ...(firstPartyDev() && {'X-Shopify-Cli-Employee': '1'}),
  }
  if (token) {
    const authString = token.match(/^shp(at|ua|ca|tka)/) ? token : `Bearer ${token}`

    headers.authorization = authString
    headers['X-Shopify-Access-Token'] = authString
  }

  return headers
}

/**
 * This utility function returns the https.Agent to use for a given service.
 */
export async function httpsAgent(): Promise<https.Agent> {
  return new https.Agent({
    rejectUnauthorized: true,
    keepAlive: true,
  })
}
