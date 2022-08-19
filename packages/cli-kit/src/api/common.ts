import {firstPartyDev} from '../environment/local.js'
import constants from '../constants.js'
import {stringifyMessage, content, token as outputToken, token, debug} from '../output.js'
import {Abort, ApiError} from '../error.js'
import {fromPromise, ResultAsync} from '../common/typing/result/result-async.js'
import {ClientError, RequestDocument, Variables} from 'graphql-request'
import {randomUUID} from 'crypto'

export async function buildHeaders(token: string): Promise<{[key: string]: string}> {
  const userAgent = `Shopify CLI; v=${await constants.versions.cliKit()}`

  const headers = {
    'User-Agent': userAgent,
    // 'Sec-CH-UA': secCHUA, This header requires the Git sha.
    'Sec-CH-UA-PLATFORM': process.platform,
    'X-Request-Id': randomUUID(),
    authorization: `Bearer ${token}`,
    'X-Shopify-Access-Token': `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...(firstPartyDev() && {'X-Shopify-Cli-Employee': '1'}),
  }

  return headers
}

/**
 * Removes the sensitive data from the headers and outputs them as a string.
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

export async function debugLogRequest<T>(
  api: string,
  query: RequestDocument,
  variables?: Variables,
  headers: {[key: string]: string} = {},
) {
  debug(`
Sending ${token.raw(api)} GraphQL request:
${query}

With variables:
${variables ? JSON.stringify(variables, null, 2) : ''}

And headers:
${sanitizedHeadersOutput(headers)}
`)
}

export function handlingErrors<T>(api: string, action: () => Promise<T>): ResultAsync<T, Error> {
  return fromPromise(action(), (error) => {
    if (error instanceof ClientError) {
      const errorMessage = stringifyMessage(content`
  The ${token.raw(
    api,
  )} GraphQL API responded unsuccessfully with the HTTP status ${`${error.response.status}`} and errors:

  ${outputToken.json(error.response.errors)}
      `)
      if (error.response.status < 500) {
        return new ApiError(error.message, error.response.status)
      } else {
        return new Abort(errorMessage)
      }
    } else if (typeof error === 'string' && (error as string).trim().length !== 0) {
      return new Error(error)
    } else {
      return new Error('Unknown error')
    }
  })
}
