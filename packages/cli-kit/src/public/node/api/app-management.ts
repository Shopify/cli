import {graphqlRequest, GraphQLVariables, GraphQLResponse} from './graphql.js'
import {appManagementFqdn} from '../context/fqdn.js'
import {setNextDeprecationDate} from '../../../private/node/context/deprecations-store.js'
import {runWithCommandCache} from '../command-cache.js'
import Bottleneck from 'bottleneck'
import {hashString} from '@shopify/cli-kit/node/crypto'

// API Rate limiter for partners API (Limit is 10 requests per second)
// Jobs are launched every 150ms to add an extra 50ms margin per request.
// Only 10 requests can be executed concurrently.
const limiter = new Bottleneck({
  minTime: 150,
  maxConcurrent: 10,
})

export interface AppManagementRequestOptions {
  variables?: GraphQLVariables
  cacheEnabled?: boolean
}

/**
 * Executes an org-scoped GraphQL query against the App Management API.
 *
 * @param orgId - The organization ID.
 * @param query - GraphQL query to execute.
 * @param token - Partners token.
 * @param options - Additional options for the request:
 * - variables - GraphQL variables to pass to the query.
 * - cacheEnabled: Whether to cache the result of the query during the command execution. Disabled by default.
 * @returns The response of the query of generic type <T>.
 */
export async function appManagementRequest<T>(
  orgId: string,
  query: string,
  token: string,
  options: AppManagementRequestOptions = {},
): Promise<T> {
  const api = 'App Management'
  const fqdn = await appManagementFqdn()
  const url = `https://${fqdn}/app_management/unstable/organizations/${orgId}/graphql.json`
  const {variables, cacheEnabled = false} = options
  const cacheKey = hashString(`${query}-${JSON.stringify(variables)}`)

  const fn = () =>
    limiter.schedule<T>(() =>
      graphqlRequest({
        query,
        api,
        url,
        token,
        variables,
        responseOptions: {onResponse: handleDeprecations},
      }),
    )

  return cacheEnabled ? runWithCommandCache(cacheKey, fn) : fn()
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
