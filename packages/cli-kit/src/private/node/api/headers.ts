import {CLI_KIT_VERSION} from '../../../public/common/version.js'
import {firstPartyDev} from '../../../public/node/context/local.js'
import {Environment, serviceEnvironment} from '../context/service.js'
import {ExtendableError} from '../../../public/node/error.js'
import https from 'https'

export class RequestClientError extends ExtendableError {
  statusCode: number
  public constructor(message: string, statusCode: number) {
    super(message)
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
    const authString = token.match(/^shp(at|ua|ca)/) ? token : `Bearer ${token}`
    // eslint-disable-next-line dot-notation
    headers['authorization'] = authString
    headers['X-Shopify-Access-Token'] = authString
  }

  return headers
}

/**
 * This utility function returns the https.Agent to use for a given service. The agent
 * includes the right configuration based on the service's environment. For example,
 * if the service is running in a Spin environment, the attribute "rejectUnauthorized" is
 * set to false
 */
export async function httpsAgent(): Promise<https.Agent> {
  return new https.Agent({
    rejectUnauthorized: await shouldRejectUnauthorizedRequests(),
    keepAlive: true,
  })
}

/**
 * Spin stores the CA certificate in the keychain and it should be used when sending HTTP
 * requests to Spin instances. However, Node doesn't read certificates from the Keychain
 * by default, which leads to Shopifolks running into issues that they workaround by setting the
 * NODE_TLS_REJECT_UNAUTHORIZED=0 environment variable, which applies to all the HTTP
 * requests sent from the CLI (context: https://github.com/nodejs/node/issues/39657)
 * This utility function allows controlling the behavior in a per-service level by returning
 * the value of for the "rejectUnauthorized" attribute that's used in the https agent.
 *
 * @returns A promise that resolves with a boolean indicating whether
 * unauthorized requests should be rejected or not.
 */
async function shouldRejectUnauthorizedRequests(): Promise<boolean> {
  return (await serviceEnvironment()) !== Environment.Spin
}
