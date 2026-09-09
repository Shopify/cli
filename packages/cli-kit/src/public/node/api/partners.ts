import {graphqlRequest, GraphQLVariables, CacheOptions, UnauthorizedHandler, handleDeprecations} from './graphql.js'
import {partnersFqdn} from '../context/fqdn.js'
import {RequestModeInput} from '../http.js'
import Bottleneck from 'bottleneck'

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

export {handleDeprecations}
