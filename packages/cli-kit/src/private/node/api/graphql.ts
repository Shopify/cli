import {GraphQLClientError, sanitizedHeadersOutput} from './headers.js'
import {sanitizeURL} from './urls.js'
import {stringifyMessage, outputContent, outputToken, outputDebug} from '../../../public/node/output.js'
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

function sanitizeVariables(variables: Variables): string {
  const result: Variables = {...variables}
  if ('apiKey' in result) {
    result.apiKey = '*****'
  }
  return JSON.stringify(result, null, 2)
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
      const mappedError: Error = new GraphQLClientError(errorMessage, status, error.response.errors)
      mappedError.stack = error.stack
      return mappedError
    } else {
      return error
    }
  }
}
