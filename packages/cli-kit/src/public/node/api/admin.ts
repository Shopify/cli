import {graphqlRequest, graphqlRequestDoc, GraphQLResponseOptions, GraphQLVariables} from './graphql.js'
import {AdminSession} from '../session.js'
import {outputContent, outputToken} from '../../../public/node/output.js'
import {BugError, AbortError} from '../error.js'
import {
  restRequestBody,
  restRequestHeaders,
  restRequestUrl,
  isThemeAccessSession,
} from '../../../private/node/api/rest.js'
import {fetch} from '../http.js'
import {PublicApiVersions} from '../../../cli/api/graphql/admin/generated/public_api_versions.js'
import {normalizeStoreFqdn} from '../context/fqdn.js'
import {themeKitAccessDomain} from '../../../private/node/constants.js'
import {ClientError, Variables} from 'graphql-request'
import {TypedDocumentNode} from '@graphql-typed-document-node/core'

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
  const version = await fetchLatestSupportedApiVersion(session)
  const store = await normalizeStoreFqdn(session.storeFqdn)
  const url = adminUrl(store, version, session)
  const addedHeaders = themeAccessHeaders(session)
  return graphqlRequest({query, api, addedHeaders, url, token: session.token, variables})
}

/**
 * Executes a GraphQL query against the Admin API. Uses typed documents.
 *
 * @param query - GraphQL query to execute.
 * @param session - Shopify admin session including token and Store FQDN.
 * @param variables - GraphQL variables to pass to the query.
 * @param version - API version.
 * @param responseOptions - Control how API responses will be handled.
 * @returns The response of the query of generic type <TResult>.
 */
export async function adminRequestDoc<TResult, TVariables extends Variables>(
  query: TypedDocumentNode<TResult, TVariables>,
  session: AdminSession,
  variables?: TVariables,
  version?: string,
  responseOptions?: GraphQLResponseOptions<TResult>,
): Promise<TResult> {
  let apiVersion = version
  if (!version) {
    apiVersion = await fetchLatestSupportedApiVersion(session)
  }
  const store = await normalizeStoreFqdn(session.storeFqdn)
  const addedHeaders = themeAccessHeaders(session)
  const opts = {
    url: adminUrl(store, apiVersion, session),
    api: 'Admin',
    token: session.token,
    addedHeaders,
  }
  const result = graphqlRequestDoc<TResult, TVariables>({...opts, query, variables, responseOptions})
  return result
}

function themeAccessHeaders(session: AdminSession): {[header: string]: string} {
  return isThemeAccessSession(session)
    ? {'X-Shopify-Shop': session.storeFqdn, 'X-Shopify-Access-Token': session.token}
    : {}
}

/**
 * GraphQL query to retrieve the latest supported API version.
 *
 * @param session - Shopify admin session including token and Store FQDN.
 * @returns - The latest supported API version.
 */
async function fetchLatestSupportedApiVersion(session: AdminSession): Promise<string> {
  const apiVersions = await supportedApiVersions(session)
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return apiVersions.reverse()[0]!
}

/**
 * GraphQL query to retrieve all supported API versions.
 *
 * @param session - Shopify admin session including token and Store FQDN.
 * @returns - An array of supported API versions.
 */
export async function supportedApiVersions(session: AdminSession): Promise<string[]> {
  const apiVersions = await fetchApiVersions(session)
  return apiVersions
    .filter((item) => item.supported)
    .map((item) => item.handle)
    .sort()
}

/**
 * GraphQL query to retrieve all API versions.
 *
 * @param session - Shopify admin session including token and Store FQDN.
 * @returns - An array of supported and unsupported API versions.
 */
async function fetchApiVersions(session: AdminSession): Promise<ApiVersion[]> {
  try {
    const response = await adminRequestDoc(PublicApiVersions, session, {}, 'unstable', {handleErrors: false})
    return response.publicApiVersions
  } catch (error) {
    if (error instanceof ClientError && error.response.status === 403) {
      const storeName = session.storeFqdn.replace('.myshopify.com', '')
      throw new AbortError(
        outputContent`Looks like you don't have access this dev store: (${outputToken.link(
          storeName,
          `https://${session.storeFqdn}`,
        )})`,
        outputContent`If you're not the owner, create a dev store staff account for yourself`,
      )
    } else if (error instanceof ClientError) {
      throw new BugError(
        `Unknown client error connecting to your store ${session.storeFqdn}: ${error.message} ${error.response.status} ${error.response.data}`,
      )
    } else {
      throw new BugError(
        `Unknown error connecting to your store ${session.storeFqdn}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }
}

/**
 * Returns the Admin API URL for the given store and version.
 *
 * @param store - Store FQDN.
 * @param version - API version.
 * @param session - User session.
 * @returns - Admin API URL.
 */
export function adminUrl(store: string, version: string | undefined, session?: AdminSession): string {
  const realVersion = version ?? 'unstable'

  const url =
    session && isThemeAccessSession(session)
      ? `https://${themeKitAccessDomain}/cli/admin/api/${realVersion}/graphql.json`
      : `https://${store}/admin/api/${realVersion}/graphql.json`
  return url
}

interface ApiVersion {
  handle: string
  supported: boolean
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

  const headers = restRequestHeaders(session)
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
