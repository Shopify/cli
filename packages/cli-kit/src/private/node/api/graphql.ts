import {GraphQLClientError, sanitizedHeadersOutput} from './headers.js'
import {stringifyMessage, outputContent, outputToken, outputDebug} from '../../../public/node/output.js'
import {AbortError} from '../../../public/node/error.js'
import {ClientError, RequestDocument, Variables} from 'graphql-request'

export function debugLogRequestInfo(
  api: string,
  query: RequestDocument,
  variables?: Variables,
  headers: {[key: string]: string} = {},
) {
  outputDebug(outputContent`Sending ${outputToken.json(api)} GraphQL request:
  ${outputToken.raw(query.toString().trim())}
${variables ? `\nWith variables:\n${sanitizeVariables(variables)}\n` : ''}
With request headers:
${sanitizedHeadersOutput(headers)}
`)
}

function sanitizeVariables(variables: Variables): string {
  const result: Variables = {...variables}
  if ('apiKey' in result) {
    result.apiKey = '*****'
  }
  return JSON.stringify(result, null, 2)
}

export function errorHandler(api: string): (error: unknown, requestId?: string) => Error | unknown {
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
