import {AdminSession} from '../session.js'
import {content, token as outputToken} from '../../../output.js'
import {Bug, Abort} from '../../../error.js'
import {graphqlRequest, GraphQLVariables} from '../../../private/node/api/graphql.js'
import {restRequestBody, restRequestHeaders, restRequestUrl} from '../../../private/node/api/rest.js'
import fetch from '../../../http/fetch.js'
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

/**
 * Executes a REST request against the Admin API.
 *
 * @param method - Request's HTTP method.
 * @param path - Path of the REST resource.
 * @param session - Shopify Admin session including token and Store FQDN.
 * @param requestBody - Request body of including REST resource specific parameters.
 * @param searchParams - Search params, appended to the URL.
 * @param apiVersion - Admin API version.
 * @returns - The {@link RestResponse}.
 */
export async function restRequest<T>(
  method: string,
  path: string,
  session: AdminSession,
  requestBody?: T,
  searchParams: {[name: string]: string} = {},
  apiVersion = 'unstable',
): Promise<RestResponse> {
  const url = restRequestUrl(session, apiVersion, path, searchParams)
  const body = restRequestBody<T>(requestBody)

  const headers = await restRequestHeaders(session)
  const response = await fetch(url, {
    headers,
    method,
    body,
  })

  const json = await response.json().catch(() => ({}))

  return {
    json,
    status: response.status,
    headers: response.headers.raw(),
  }
}

/**
 * Respose of a REST request.
 */
export interface RestResponse {
  /**
   * REST JSON respose.
   */
  // Using `any` to avoid introducing extra DTO layers.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  json: any

  /**
   * HTTP response status.
   */
  status: number

  /**
   * HTTP response headers.
   */
  headers: {[key: string]: string[]}
}
