import {buildHeaders, httpsAgent, RequestClientError, sanitizedHeadersOutput} from './headers.js'
import {stringifyMessage, outputContent, outputToken, outputDebug} from '../../../public/node/output.js'
import {AbortError} from '../../../public/node/error.js'
import {debugLogResponseInfo} from '../api.js'
import {setNextDeprecationDate} from '../conf-store.js'
import {ClientError, GraphQLClient, RequestDocument, Variables, rawRequest} from 'graphql-request'

export interface GraphQLVariables {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

export type GraphQLResponse<T> = Awaited<ReturnType<typeof rawRequest<T>>>

interface Deprecation {
  supportedUntilDate: string
}

interface WithDeprecations {
  deprecations?: Deprecation[]
}

export async function graphqlRequest<T>(
  query: RequestDocument,
  api: string,
  url: string,
  token: string,
  variables?: Variables,
  handleErrors = true,
): Promise<T> {
  const headers = buildHeaders(token)
  debugLogRequestInfo(api, query, variables, headers)
  const clientOptions = {agent: await httpsAgent(), headers}
  const client = new GraphQLClient(url, clientOptions)
  const response: GraphQLResponse<T> = await debugLogResponseInfo(
    {request: client.rawRequest<T>(query as string, variables), url},
    handleErrors ? errorHandler(api) : undefined,
  )

  handleDeprecations(response)

  return response.data
}

function debugLogRequestInfo<T>(
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

function errorHandler<T>(api: string): (error: unknown) => Error | unknown {
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

export function handleDeprecations<T>(response: GraphQLResponse<T>) {
  const deprecations = (response.extensions as WithDeprecations)?.deprecations
  if (deprecations) {
    const deprecationDates = deprecations.map(({supportedUntilDate}) => new Date(supportedUntilDate))
    setNextDeprecationDate(deprecationDates)
  }
}
