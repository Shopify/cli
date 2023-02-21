import {buildHeaders, httpsAgent, RequestClientError, sanitizedHeadersOutput} from './headers.js'
import {stringifyMessage, outputContent, outputToken, outputDebug} from '../../../public/node/output.js'
import {AbortError} from '../../../public/node/error.js'
import {debugLogResponseInfo} from '../api.js'
import {ClientError, GraphQLClient, RequestDocument, Variables} from 'graphql-request'

export interface GraphQLVariables {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

export function graphqlRequest<T>(
  query: RequestDocument,
  api: string,
  url: string,
  token: string,
  variables?: Variables,
  handleErrors = true,
): Promise<T> {
  const action = async () => {
    const headers = buildHeaders(token)
    debugLogRequestInfo(api, query, variables, headers)
    const clientOptions = {agent: await httpsAgent(), headers}
    const client = new GraphQLClient(url, clientOptions)
    const response = await debugLogResponseInfo({request: client.rawRequest<T>(query as string, variables), url})
    return response.data
  }

  if (handleErrors) {
    return handlingErrors(api, action)
  } else {
    return action()
  }
}

function debugLogRequestInfo<T>(
  api: string,
  query: RequestDocument,
  variables?: Variables,
  headers: {[key: string]: string} = {},
) {
  outputDebug(outputContent`Sending ${outputToken.json(api)} GraphQL request:
${outputToken.raw(query.toString().trim())}

With variables:
${variables ? JSON.stringify(variables, null, 2) : ''}

And request headers:
${sanitizedHeadersOutput(headers)}
`)
}

async function handlingErrors<T>(api: string, action: () => Promise<T>): Promise<T> {
  try {
    return await action()
  } catch (error) {
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
      throw mappedError
    } else {
      throw error
    }
  }
}
