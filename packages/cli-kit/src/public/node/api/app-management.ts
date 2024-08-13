import {graphqlRequest, GraphQLVariables, GraphQLResponse} from './graphql.js'
import {appManagementFqdn} from '../context/fqdn.js'
import {setNextDeprecationDate} from '../../../private/node/context/deprecations-store.js'
import {LocalStorage} from '../local-storage.js'
import {outputContent, outputDebug, outputToken} from '../output.js'
import {sanitizeVariables} from '../../../private/node/api/graphql.js'
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
  let queries = {} as {[key: string]: unknown}

  if (cacheEnabled) {
    const data = getCachedCommandInfo()
    if (data) {
      queries = data.queries as {[key: string]: unknown}
      if (queries[cacheKey]) {
        outputDebug(outputContent`Reading from cache ${outputToken.json(api)} GraphQL request:
    ${outputToken.raw(query.trim())}
  ${variables ? `\nWith variables:\n${sanitizeVariables(variables)}\n` : ''}
  `)
        return queries[cacheKey] as T
      }
    }
  }

  const result = await limiter.schedule<T>(() =>
    graphqlRequest({
      query,
      api,
      url,
      token,
      variables,
      responseOptions: {onResponse: handleDeprecations},
    }),
  )

  if (cacheEnabled && query.trim().startsWith('query')) {
    outputDebug('Caching result...')
    queries[cacheKey] = result
    setCachedCommandInfo({queries})
  }

  return result
}

interface CommandLocalStorage {
  [key: string]: {[key: string]: unknown}
}

let _commandLocalStorageInstance: LocalStorage<CommandLocalStorage> | undefined

function commandLocalStorage() {
  if (!_commandLocalStorageInstance) {
    _commandLocalStorageInstance = new LocalStorage<CommandLocalStorage>({projectName: 'shopify-cli-app-command'})
  }
  return _commandLocalStorageInstance
}

function setCachedCommandInfo(data: {[key: string]: unknown}): void {
  const id = process.env.COMMAND_RUN_ID

  if (!id) return

  const store = commandLocalStorage()
  const info = store.get(id)

  store.set(id, {
    ...info,
    ...data,
  })
}

/**
 *
 */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function getCachedCommandInfo() {
  const id = process.env.COMMAND_RUN_ID

  if (!id) return

  const store = commandLocalStorage()
  return store.get(id)
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
