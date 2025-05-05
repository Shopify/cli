import {
  graphqlRequest,
  GraphQLVariables,
  GraphQLResponse,
  graphqlRequestDoc,
  CacheOptions,
  UnauthorizedHandler,
} from './graphql.js'
import {addCursorAndFiltersToAppLogsUrl} from './utilities.js'
import {partnersFqdn} from '../context/fqdn.js'
import {setNextDeprecationDate} from '../../../private/node/context/deprecations-store.js'
import {getPackageManager} from '../node-package-manager.js'
import {cwd} from '../path.js'
import {AbortError} from '../error.js'
import {formatPackageManagerCommand} from '../output.js'
import {RequestModeInput} from '../http.js'
import Bottleneck from 'bottleneck'
import {Variables} from 'graphql-request'
import {TypedDocumentNode} from '@graphql-typed-document-node/core'

// API Rate limiter for partners API (Limit is 10 requests per second)
// Jobs are launched every 150ms to add an extra 50ms margin per request.
// Only 10 requests can be executed concurrently.
const limiter = new Bottleneck({
  minTime: 150,
  maxConcurrent: 10,
})

/**
 * Sets up the request to the Partners API.
 *
 * @param token - Partners token.
 */
async function setupRequest(token: string) {
  const api = 'Partners'
  const fqdn = await partnersFqdn()
  const url = `https://${fqdn}/api/cli/graphql`
  return {
    token,
    api,
    url,
    responseOptions: {onResponse: handleDeprecations},
  }
}

/**
 * Executes a GraphQL query against the Partners API.
 *
 * @param query - GraphQL query to execute.
 * @param token - Partners token.
 * @param variables - GraphQL variables to pass to the query.
 * @param cacheOptions - Cache options.
 * @param preferredBehaviour - Preferred behaviour for the request.
 * @param unauthorizedHandler - Optional handler for unauthorized requests.
 * @returns The response of the query of generic type <T>.
 */
export async function partnersRequest<T>(
  query: string,
  token: string,
  variables?: GraphQLVariables,
  cacheOptions?: CacheOptions,
  preferredBehaviour?: RequestModeInput,
  unauthorizedHandler?: UnauthorizedHandler,
): Promise<T> {
  const opts = await setupRequest(token)
  const result = limiter.schedule(() =>
    graphqlRequest<T>({
      ...opts,
      query,
      variables,
      cacheOptions,
      preferredBehaviour,
      unauthorizedHandler,
    }),
  )

  return result
}

export const generateFetchAppLogUrl = async (
  cursor?: string,
  filters?: {
    status?: string
    source?: string
  },
): Promise<string> => {
  const fqdn = await partnersFqdn()
  const url = `https://${fqdn}/app_logs/poll`
  return addCursorAndFiltersToAppLogsUrl(url, cursor, filters)
}

/**
 * Executes a GraphQL query against the Partners API. Uses typed documents.
 *
 * @param query - GraphQL query to execute.
 * @param token - Partners token.
 * @param variables - GraphQL variables to pass to the query.
 * @param preferredBehaviour - Preferred behaviour for the request.
 * @param unauthorizedHandler - Optional handler for unauthorized requests.
 * @returns The response of the query of generic type <TResult>.
 */
export async function partnersRequestDoc<TResult, TVariables extends Variables>(
  query: TypedDocumentNode<TResult, TVariables>,
  token: string,
  variables?: TVariables,
  preferredBehaviour?: RequestModeInput,
  unauthorizedHandler?: UnauthorizedHandler,
): Promise<TResult> {
  try {
    const opts = await setupRequest(token)
    const result = limiter.schedule(() =>
      graphqlRequestDoc<TResult, TVariables>({
        ...opts,
        query,
        variables,
        preferredBehaviour,
        unauthorizedHandler,
      }),
    )

    return result
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    if (error.errors?.[0]?.extensions?.type === 'unsupported_client_version') {
      const packageManager = await getPackageManager(cwd())

      throw new AbortError(['Upgrade your CLI version to run this command.'], null, [
        ['Run', {command: formatPackageManagerCommand(packageManager, 'shopify upgrade')}],
      ])
    }

    throw error
  }
}

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
