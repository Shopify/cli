import {graphqlRequest, GraphQLVariables, GraphQLResponse} from './graphql.js'
import {partnersFqdn} from '../context/fqdn.js'
import {setNextDeprecationDate} from '../../../private/node/context/deprecations-store.js'
import {gql} from 'graphql-request'
import Bottleneck from 'bottleneck'

// API Rate limiter for partners API (Limit is 10 requests per second)
// Jobs are launched every 150ms to add an extra 50ms margin per request.
// Only 10 requests can be executed concurrently.
const limiter = new Bottleneck({
  minTime: 150,
  maxConcurrent: 10,
})

/**
 * Executes a GraphQL query against the Partners API.
 *
 * @param query - GraphQL query to execute.
 * @param token - Partners token.
 * @param variables - GraphQL variables to pass to the query.
 * @returns The response of the query of generic type <T>.
 */
export async function partnersRequest<T>(query: string, token: string, variables?: GraphQLVariables): Promise<T> {
  const api = 'Partners'
  const fqdn = await partnersFqdn()
  const url = `https://${fqdn}/api/cli/graphql`
  const result = limiter.schedule<T>(() =>
    graphqlRequest({
      query,
      api,
      url,
      token,
      variables,
      responseOptions: {onResponse: handleDeprecations},
    }),
  )

  return result
}

export interface FunctionUploadUrlGenerateResponse {
  functionUploadUrlGenerate: {
    generatedUrlDetails: {
      url: string
      moduleId: string
      headers: {[key: string]: string}
      maxBytes: number
      maxSize: string
    }
  }
}

/**
 * Request a URL from partners to which we will upload our function.
 *
 * @param token - Partners token.
 * @returns The response of the query.
 */
export async function getFunctionUploadUrl(token: string): Promise<FunctionUploadUrlGenerateResponse> {
  const functionUploadUrlGenerateMutation = FunctionUploadUrlGenerateMutation
  const res: FunctionUploadUrlGenerateResponse = await partnersRequest(FunctionUploadUrlGenerateMutation, token)
  return res
}

const FunctionUploadUrlGenerateMutation = gql`
  mutation functionUploadUrlGenerateMutation {
    functionUploadUrlGenerate {
      generatedUrlDetails {
        url
        moduleId
        headers
        maxBytes
        maxSize
      }
    }
  }
`

interface Deprecation {
  supportedUntilDate?: string
}

interface WithDeprecations {
  deprecations: Deprecation[]
}

/**
 * Sets the next deprecation date from [GraphQL response extensions](https://www.apollographql.com/docs/resources/graphql-glossary/#extensions)
 * if `response.extensions.deprecations` objects contain a `supportedUntilDate` (ISO 8601-formatted string).
 *
 * @param response - The response of the query.
 */
export function handleDeprecations<T>(response: GraphQLResponse<T>): void {
  if (!response.extensions) return

  const deprecationDates: Date[] = []
  for (const deprecation of (response.extensions as WithDeprecations).deprecations) {
    if (deprecation.supportedUntilDate) {
      deprecationDates.push(new Date(deprecation.supportedUntilDate))
    }
  }

  setNextDeprecationDate(deprecationDates)
}
