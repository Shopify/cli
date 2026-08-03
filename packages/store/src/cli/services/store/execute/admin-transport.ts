import {
  classifyAdminApiError,
  isGraphQLClientErrorLike,
  throwIfStoredStoreAuthIsInvalid,
  ABORTED_FETCH_MESSAGE_FRAGMENTS,
} from '../admin-errors.js'
import {adminUrl} from '@shopify/cli-kit/node/api/admin'
import {graphqlRequest} from '@shopify/cli-kit/node/api/graphql'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputContent} from '@shopify/cli-kit/node/output'
import {renderSingleTask} from '@shopify/cli-kit/node/ui'
import type {AdminSession} from '@shopify/cli-kit/node/session'
import type {PreparedStoreExecuteRequest} from './request.js'
import type {AdminStoreGraphQLContext} from './admin-context.js'
import type {StoredStoreAppSession} from '@shopify/cli-kit/node/store-auth-session'
import type {JsonValue, StoreExecuteResult} from './types.js'

export {ABORTED_FETCH_MESSAGE_FRAGMENTS}

interface ApiVersion {
  handle: string
  supported: boolean
}

interface PublicApiVersionsResponse {
  publicApiVersions: ApiVersion[]
}

const PUBLIC_API_VERSIONS_QUERY = `
  query StoreExecutePublicApiVersions {
    publicApiVersions {
      handle
      supported
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
    return response.publicApiVersions
  } catch (error) {
    throwIfStoredStoreAuthIsInvalid(error, input.session)

    const classified = classifyAdminApiError(error, input.adminSession.storeFqdn)
    if (classified) throw classified

    throw error
  }
}

export async function runAdminStoreGraphQLOperation(input: {
  context: AdminStoreGraphQLContext
  request: PreparedStoreExecuteRequest
}): Promise<StoreExecuteResult> {
  try {
    const response = await renderSingleTask({
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
    return storeExecuteResult(response)
  } catch (error) {
    throwIfStoredStoreAuthIsInvalid(error, input.context.session)

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

function storeExecuteResult(response: unknown): StoreExecuteResult {
  const data = response as JsonValue
  const userErrors = findUserErrors(data)
  return userErrors.length > 0 ? {data, failure: {code: 'USER_ERRORS', details: userErrors}} : {data}
}

function findUserErrors(value: JsonValue): JsonValue[] {
  if (Array.isArray(value)) return value.flatMap(findUserErrors)
  if (value === null || typeof value !== 'object') return []

  const errors = 'userErrors' in value && Array.isArray(value.userErrors) ? value.userErrors : []
  return [
    ...errors,
    ...Object.entries(value).flatMap(([key, child]) => (key === 'userErrors' ? [] : findUserErrors(child))),
  ]
}
