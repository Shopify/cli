import {RequestClientError, sanitizedHeadersOutput} from './headers.js'
import {stringifyMessage, outputContent, outputToken, outputDebug} from '../../../public/node/output.js'
import {AbortError} from '../../../public/node/error.js'
import {ClientError, RequestDocument, Variables} from 'graphql-request'

export function debugLogRequestInfo<T>(
  api: string,
  query: RequestDocument,
  variables?: Variables,
  headers: {[key: string]: string} = {},
) {
  outputDebug(outputContent`Sending ${outputToken.json(api)} GraphQL request:
  ${outputToken.raw(query.toString().trim())}
${variables ? `\nWith variables:\n${JSON.stringify(variables, null, 2)}\n` : ''}
With request headers:
${sanitizedHeadersOutput(headers)}
`)
}

export function errorHandler<T>(api: string): (error: unknown) => Error | unknown {
  return (error: unknown) => {
    if (error instanceof ClientError) {
      const errorMessage = stringifyMessage(outputContent`
  The ${outputToken.raw(
    api,
  )} GraphQL API responded unsuccessfully with the HTTP status ${`${error.response.status}`} and errors:

  ${outputToken.json(error.response.errors)}
      `)
      let mappedError: Error
      if (error.response.status < 500) {
        mappedError = new RequestClientError(errorMessage, error.response.status)
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
