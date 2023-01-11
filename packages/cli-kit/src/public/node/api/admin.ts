import {AdminSession} from '../../../session.js'
import {content, token as outputToken} from '../../../output.js'
import {Bug, Abort} from '../../../error.js'
import {graphqlRequest, GraphQLVariables} from '../../../private/node/api/graphql.js'
import {ClientError, gql} from 'graphql-request'

/**
 * Executes a GraphQL query against the Admin API.
 *
 * @param query - GraphQL query to execute.
 * @param session - Shopify admin session including token and Store FQDN.
 * @param variables - GraphQL variables to pass to the query.
 * @returns The response of the query of generic type <T>.
 */
export async function adminRequest<T>(query: string, session: AdminSession, variables?: GraphQLVariables): Promise<T> {
  const api = 'Admin'
  const version = await fetchApiVersion(session)
  const url = adminUrl(session.storeFqdn, version)
  return graphqlRequest(query, api, url, session.token, variables)
}

/**
 * GraphQL query to retrieve the latest supported API version.
 *
 * @param session - Shopify admin session including token and Store FQDN.
 * @returns - The latest supported API version.
 */
async function fetchApiVersion(session: AdminSession): Promise<string> {
  const url = adminUrl(session.storeFqdn, 'unstable')
  const query = apiVersionQuery()
  try {
    const data: ApiVersionResponse = await graphqlRequest(query, 'Admin', url, session.token, {}, false)

    return data.publicApiVersions
      .filter((item) => item.supported)
      .map((item) => item.handle)
      .sort()
      .reverse()[0]!
  } catch (error) {
    if (error instanceof ClientError && error.response.status === 403) {
      const storeName = session.storeFqdn.replace('.myshopify.com', '')
      throw new Abort(
        content`Looks like you don't have access this dev store: (${outputToken.link(
          storeName,
          `https://${session.storeFqdn}`,
        )})`,
        content`If you're not the owner, create a dev store staff account for yourself`,
      )
    }
    throw new Bug(`Unknown error connecting to your store`)
  }
}

/**
 * Returns the Admin API URL for the given store and version.
 *
 * @param store - Store FQDN.
 * @param version - API version.
 * @returns - Admin API URL.
 */
function adminUrl(store: string, version: string | undefined): string {
  const realVersion = version || 'unstable'
  return `https://${store}/admin/api/${realVersion}/graphql.json`
}

interface ApiVersionResponse {
  publicApiVersions: {handle: string; supported: boolean}[]
}

/**
 * GraphQL query string to retrieve the latest supported API version.
 *
 * @returns - A query string.
 */
function apiVersionQuery(): string {
  return gql`
    query {
      publicApiVersions {
        handle
        supported
      }
    }
  `
}
