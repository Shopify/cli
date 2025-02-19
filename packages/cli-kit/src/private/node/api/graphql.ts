import {GraphQLClientError, sanitizedHeadersOutput} from './headers.js'
import {sanitizeURL} from './urls.js'
import {stringifyMessage, outputContent, outputToken, outputDebug} from '../../../public/node/output.js'
import {AbortError} from '../../../public/node/error.js'
import {ClientError, Variables} from 'graphql-request'

export function debugLogRequestInfo(
  api: string,
  query: string,
  url: string,
  variables?: Variables,
  headers: {[key: string]: string} = {},
) {
  outputDebug(outputContent`Sending ${outputToken.json(api)} GraphQL request:
  ${outputToken.raw(query.toString().trim())}
${variables ? `\nWith variables:\n${sanitizeVariables(variables)}\n` : ''}
With request headers:
${sanitizedHeadersOutput(headers)}\n
to ${sanitizeURL(url)}`)
}

export function sanitizeVariables(variables: Variables): string {
  const result: Variables = {...variables}
  const sensitiveKeys = ['apiKey', 'serialized_script']

  const sanitizedResult = sanitizeDeepVariables(result, sensitiveKeys)

  return JSON.stringify(sanitizedResult, null, 2)
}

function sanitizeDeepVariables(value: unknown, sensitiveKeys: string[]): unknown {
  // Checking for JSON
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (typeof parsed === 'object' && parsed !== null) {
        const sanitized = sanitizeDeepVariables(parsed, sensitiveKeys)
        return JSON.stringify(sanitized, null)
      }
    } catch (error) {
      return value
    }
  }

  if (typeof value !== 'object' || value === null) {
    return value
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeDeepVariables(item, sensitiveKeys))
  }

  const result: Variables = {}

  for (const [key, val] of Object.entries(value)) {
    if (sensitiveKeys.includes(key) && typeof val === 'string') {
      result[key] = '*****'
      continue
    }

    result[key] = sanitizeDeepVariables(val, sensitiveKeys)
  }

  return result
}

export function errorHandler(api: string): (error: unknown, requestId?: string) => unknown {
  return (error: unknown, requestId?: string) => {
    if (error instanceof ClientError) {
      const {status} = error.response
      let errorMessage = stringifyMessage(outputContent`
The ${outputToken.raw(api)} GraphQL API responded unsuccessfully with${
        status === 200 ? '' : ` the HTTP status ${status} and`
      } errors:

${outputToken.json(error.response.errors)}
      `)
      if (requestId) {
        errorMessage += `
Request ID: ${requestId}
`
      }
      let mappedError: Error
      if (status < 500) {
        mappedError = new GraphQLClientError(errorMessage, status, error.response.errors)
      } else {
        mappedError = new AbortError(errorMessage)
      }
      mappedError.stack = error.stack
      return mappedError
    } else {
      return error
    }
  }
}
