import {
  graphqlRequest,
  graphqlRequestDoc,
  GraphQLResponseOptions,
  GraphQLVariables,
  UnauthorizedHandler,
} from './graphql.js'
import {AdminSession} from '../session.js'
import {outputContent, outputToken} from '../../../public/node/output.js'
import {AbortError, BugError} from '../error.js'
import {
  restRequestBody,
  restRequestHeaders,
  restRequestUrl,
  isThemeAccessSession,
} from '../../../private/node/api/rest.js'
import {isNetworkError} from '../../../private/node/api.js'
import {RequestModeInput, shopifyFetch} from '../http.js'
import {PublicApiVersions} from '../../../cli/api/graphql/admin/generated/public_api_versions.js'

import {themeKitAccessDomain} from '../../../private/node/constants.js'
import {serviceEnvironment} from '../../../private/node/context/service.js'
import {DevServerCore} from '../vendor/dev_server/index.js'
import {ClientError, Variables} from 'graphql-request'
import {TypedDocumentNode} from '@graphql-typed-document-node/core'

const LatestApiVersionByFQDN = new Map<string, string>()

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
  let storeDomain = session.storeFqdn
  const addedHeaders = themeAccessHeaders(session)

  if (serviceEnvironment() === 'local') {
    addedHeaders['x-forwarded-host'] = storeDomain
    storeDomain = new DevServerCore().host('app')
  }

  const url = adminUrl(storeDomain, version, session)
  return graphqlRequest({query, api, addedHeaders, url, token: session.token, variables})
}

export interface AdminRequestOptions<TResult, TVariables extends Variables> {
  /** GraphQL query to execute. */
  query: TypedDocumentNode<TResult, TVariables>
  /** Shopify admin session including token and Store FQDN. */
  session: AdminSession
  /** GraphQL variables to pass to the query. */
  variables?: TVariables
  /** API version. */
  version?: string
  /** Control how API responses will be handled. */
  responseOptions?: GraphQLResponseOptions<TResult>
  /** Custom request behaviour for retries and timeouts. */
  preferredBehaviour?: RequestModeInput
}

/**
 * Executes a GraphQL query against the Admin API. Uses typed documents.
 *
 * @param options - Admin request options.
 * @returns The response of the query of generic type <TResult>.
 */
export async function adminRequestDoc<TResult, TVariables extends Variables>(
  options: AdminRequestOptions<TResult, TVariables>,
): Promise<TResult> {
  const {query, session, variables, version, responseOptions, preferredBehaviour} = options

  let apiVersion = version ?? LatestApiVersionByFQDN.get(session.storeFqdn)
  if (!apiVersion) {
    apiVersion = await fetchLatestSupportedApiVersion(session, preferredBehaviour)
  }
  let storeDomain = session.storeFqdn
  const addedHeaders = themeAccessHeaders(session)

  if (serviceEnvironment() === 'local') {
    addedHeaders['x-forwarded-host'] = storeDomain
    storeDomain = new DevServerCore().host('app')
  }

  const opts = {
    url: adminUrl(storeDomain, apiVersion, session),
    api: 'Admin',
    token: session.token,
    addedHeaders,
  }
  let unauthorizedHandler: UnauthorizedHandler | undefined
  if ('refresh' in session) {
    unauthorizedHandler = {type: 'token_refresh', handler: session.refresh as () => Promise<{token: string}>}
  }
  const result = graphqlRequestDoc<TResult, TVariables>({
    ...opts,
    query,
    variables,
    responseOptions,
    unauthorizedHandler,
    preferredBehaviour,
  })
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
 * @param preferredBehaviour - Custom request behaviour for retries and timeouts.
 * @returns - The latest supported API version.
 */
async function fetchLatestSupportedApiVersion(
  session: AdminSession,
  preferredBehaviour?: RequestModeInput,
): Promise<string> {
  const apiVersions = await supportedApiVersions(session, preferredBehaviour)
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const latest = apiVersions.reverse()[0]!
  LatestApiVersionByFQDN.set(session.storeFqdn, latest)
  return latest
}

/**
 * GraphQL query to retrieve all supported API versions.
 *
 * @param session - Shopify admin session including token and Store FQDN.
 * @param preferredBehaviour - Custom request behaviour for retries and timeouts.
 * @returns - An array of supported API versions.
 */
export async function supportedApiVersions(
  session: AdminSession,
  preferredBehaviour?: RequestModeInput,
): Promise<string[]> {
  const apiVersions = await fetchApiVersions(session, preferredBehaviour)
  return apiVersions
    .filter((item) => item.supported)
    .map((item) => item.handle)
    .sort()
}

/**
 * GraphQL query to retrieve all API versions.
 *
 * @param session - Shopify admin session including token and Store FQDN.
 * @param preferredBehaviour - Custom request behaviour for retries and timeouts.
 * @returns - An array of supported and unsupported API versions.
 */
async function fetchApiVersions(session: AdminSession, preferredBehaviour?: RequestModeInput): Promise<ApiVersion[]> {
  try {
    const response = await adminRequestDoc({
      query: PublicApiVersions,
      session,
      variables: {},
      version: 'unstable',
      responseOptions: {handleErrors: false},
      preferredBehaviour,
    })
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
    }
    if (error instanceof ClientError && (error.response.status === 401 || error.response.status === 404)) {
      throw new AbortError(
        `Error connecting to your store ${session.storeFqdn}: ${error.message} ${error.response.status} ${error.response.data}`,
      )
    }

    // Check for network-level errors (connection issues, timeouts, DNS failures, TLS/certificate errors, etc.)
    // All network errors should be treated as user-facing errors, not CLI bugs
    // Note: Some of these may have been retried already by lower-level retry logic
    if (isNetworkError(error)) {
      throw new AbortError(
        `Network error connecting to your store ${session.storeFqdn}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        'Check your internet connection and try again.',
      )
    }

    // Unknown errors are likely bugs in the CLI
    throw new BugError(
      `Unknown error connecting to your store ${session.storeFqdn}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
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
  const response = await shopifyFetch(url, {
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
