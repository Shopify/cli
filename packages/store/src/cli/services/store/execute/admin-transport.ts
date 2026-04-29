import {throwReauthenticateStoreAuthError} from '../auth/recovery.js'
import {clearStoredStoreAppSession} from '../auth/session-store.js'
import {recordStoreCommandShopIdFromAdminGid} from '../metrics.js'
import {adminUrl} from '@shopify/cli-kit/node/api/admin'
import {graphqlRequest} from '@shopify/cli-kit/node/api/graphql'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputContent} from '@shopify/cli-kit/node/output'
import {renderSingleTask} from '@shopify/cli-kit/node/ui'
import type {AdminSession} from '@shopify/cli-kit/node/session'
import type {PreparedStoreExecuteRequest} from './request.js'
import type {AdminStoreGraphQLContext} from './admin-context.js'
import type {StoredStoreAppSession} from '../auth/session-store.js'

interface ApiVersion {
  handle: string
  supported: boolean
}

interface PublicApiVersionsResponse {
  publicApiVersions: ApiVersion[]
  shop?: {
    id?: string
  }
}

const PUBLIC_API_VERSIONS_QUERY = `
  query StoreExecutePublicApiVersions {
    publicApiVersions {
      handle
      supported
    }
    shop {
      id
    }
  }
`

/**
 * Runs the version-discovery GraphQL query against the Admin API. Errors are classified
 * the same way as the execute-phase request: 401/404 trigger a stored-auth re-auth flow,
 * 402 / fetch-aborts surface as user-facing `AbortError`s.
 */
export async function fetchPublicApiVersions(input: {
  adminSession: AdminSession
  session: StoredStoreAppSession
}): Promise<ApiVersion[]> {
  try {
    const response = await graphqlRequest<PublicApiVersionsResponse>({
      query: PUBLIC_API_VERSIONS_QUERY,
      api: 'Admin',
      url: adminUrl(input.adminSession.storeFqdn, 'unstable', input.adminSession),
      token: input.adminSession.token,
      responseOptions: {handleErrors: false},
    })
    await recordStoreCommandShopIdFromAdminGid(response.shop?.id)
    return response.publicApiVersions
  } catch (error) {
    const status = graphQLClientErrorStatus(error)
    if (status === 401 || status === 404) {
      clearStoredStoreAppSession(input.session.store, input.session.userId)
      throwReauthenticateStoreAuthError(
        `Stored app authentication for ${input.session.store} is no longer valid.`,
        input.session.store,
        input.session.scopes.join(','),
      )
    }

    const classified = classifyAdminApiError(error, input.adminSession.storeFqdn)
    if (classified) throw classified

    throw error
  }
}

export async function runAdminStoreGraphQLOperation(input: {
  context: AdminStoreGraphQLContext
  request: PreparedStoreExecuteRequest
}): Promise<unknown> {
  try {
    return await renderSingleTask({
      title: outputContent`Executing GraphQL operation`,
      task: async () => {
        return graphqlRequest({
          query: input.request.query,
          api: 'Admin',
          url: adminUrl(input.context.adminSession.storeFqdn, input.context.version, input.context.adminSession),
          token: input.context.adminSession.token,
          variables: input.request.parsedVariables,
          responseOptions: {handleErrors: false},
        })
      },
      renderOptions: {stdout: process.stderr},
    })
  } catch (error) {
    if (isGraphQLClientErrorLike(error) && error.response.status === 401) {
      clearStoredStoreAppSession(input.context.session.store, input.context.session.userId)
      throwReauthenticateStoreAuthError(
        `Stored app authentication for ${input.context.session.store} is no longer valid.`,
        input.context.session.store,
        input.context.session.scopes.join(','),
      )
    }

    // Status-specific classification (e.g. 402 store-unavailable) must run before the
    // generic GraphQL-errors branch, otherwise a 402 response that also carries
    // `errors: [...]` would be misreported as "GraphQL operation failed".
    const classified = classifyAdminApiError(error, input.context.adminSession.storeFqdn)
    if (classified) throw classified

    if (isGraphQLClientErrorLike(error) && error.response.errors) {
      throw new AbortError('GraphQL operation failed.', JSON.stringify({errors: error.response.errors}, null, 2))
    }

    throw error
  }
}

// ---------- error classification ----------
//
// Both Admin GraphQL calls above see the same raw error shapes from `graphqlRequest`:
//
//   - graphql-request `ClientError` (matched structurally on `{response: {status}}` so
//     `@shopify/store` doesn't need to depend on `graphql-request` at runtime),
//   - fetch-aborted `Error`s (semantic `name === 'AbortError'`, with a message-string
//     fallback for older transports).
//
// `classifyAdminApiError` covers the shapes both phases agree are user-facing rather
// than CLI bugs. Phase-specific recovery (clearing stored auth on 401/404 etc.) stays
// at the call site.

interface GraphQLClientErrorLike {
  response: {status?: number; errors?: unknown}
}

function isGraphQLClientErrorLike(error: unknown): error is GraphQLClientErrorLike {
  if (!error || typeof error !== 'object' || !('response' in error)) return false
  const response = (error as {response?: unknown}).response
  return Boolean(response) && typeof response === 'object'
}

function graphQLClientErrorStatus(error: unknown): number | undefined {
  if (!isGraphQLClientErrorLike(error)) return undefined
  const status = error.response.status
  return typeof status === 'number' ? status : undefined
}

// Lower-cased substrings that Node's fetch/undici implementations use to signal an
// aborted request. cli-kit's lower-level transport (`isTransientNetworkError` in
// packages/cli-kit/src/private/node/api.ts) already recognizes 'the operation was
// aborted'; we cover that shape and add 'the user aborted a request' (the literal
// node-fetch surfaces) so a fetch that bubbles past cli-kit's retry layer is still
// classified correctly. Exported so tests reference the same source of truth as
// production.
export const ABORTED_FETCH_MESSAGE_FRAGMENTS = ['the user aborted a request', 'the operation was aborted'] as const

function isUserAbortedFetchError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  if (error.name === 'AbortError') return true
  const message = error.message.toLowerCase()
  return ABORTED_FETCH_MESSAGE_FRAGMENTS.some((fragment) => message.includes(fragment))
}

function classifyAdminApiError(error: unknown, storeFqdn: string): AbortError | undefined {
  // 402 Payment Required: the shop is frozen / on hold / otherwise unavailable. Store-state
  // issue, not a CLI bug.
  if (graphQLClientErrorStatus(error) === 402) {
    return new AbortError(
      `The store ${storeFqdn} is currently unavailable.`,
      'Check the store in the Shopify admin and try again once it is reactivated.',
    )
  }

  // User-aborted fetches (Ctrl-C, CLI-side fetch timeouts) are user-driven, not CLI bugs.
  if (isUserAbortedFetchError(error)) {
    return new AbortError(`Request to ${storeFqdn} was aborted before it completed.`)
  }

  return undefined
}
