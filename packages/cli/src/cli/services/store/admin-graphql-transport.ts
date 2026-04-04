import {clearStoredStoreAppSession} from './session.js'
import {PreparedStoreExecuteRequest} from './execute-request.js'
import {reauthenticateStoreAuthError} from './auth-recovery.js'
import {adminUrl} from '@shopify/cli-kit/node/api/admin'
import {graphqlRequest} from '@shopify/cli-kit/node/api/graphql'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputContent} from '@shopify/cli-kit/node/output'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {renderSingleTask} from '@shopify/cli-kit/node/ui'

function isGraphQLClientError(error: unknown): error is {response: {errors?: unknown; status?: number}} {
  if (!error || typeof error !== 'object' || !('response' in error)) return false
  const response = (error as {response?: unknown}).response
  return Boolean(response) && typeof response === 'object'
}

export async function runAdminStoreGraphQLOperation(input: {
  store: string
  adminSession: AdminSession
  sessionUserId: string
  version: string
  request: PreparedStoreExecuteRequest
}): Promise<unknown> {
  try {
    return await renderSingleTask({
      title: outputContent`Executing GraphQL operation`,
      task: async () => {
        return graphqlRequest({
          query: input.request.query,
          api: 'Admin',
          url: adminUrl(input.adminSession.storeFqdn, input.version, input.adminSession),
          token: input.adminSession.token,
          variables: input.request.parsedVariables,
          responseOptions: {handleErrors: false},
        })
      },
      renderOptions: {stdout: process.stderr},
    })
  } catch (error) {
    if (isGraphQLClientError(error) && error.response.status === 401) {
      clearStoredStoreAppSession(input.store, input.sessionUserId)
      throw reauthenticateStoreAuthError(
        `Stored app authentication for ${input.store} is no longer valid.`,
        input.store,
        '<comma-separated-scopes>',
      )
    }

    if (isGraphQLClientError(error) && error.response.errors) {
      throw new AbortError('GraphQL operation failed.', JSON.stringify({errors: error.response.errors}, null, 2))
    }

    throw error
  }
}
