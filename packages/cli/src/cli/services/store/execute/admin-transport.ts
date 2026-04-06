import {adminUrl} from '@shopify/cli-kit/node/api/admin'
import {graphqlRequest} from '@shopify/cli-kit/node/api/graphql'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputContent} from '@shopify/cli-kit/node/output'
import {renderSingleTask} from '@shopify/cli-kit/node/ui'
import {reauthenticateStoreAuthError} from '../auth/recovery.js'
import {clearStoredStoreAppSession} from '../auth/session-store.js'
import type {PreparedStoreExecuteRequest} from './request.js'
import type {AdminStoreGraphQLContext} from './admin-context.js'

function isGraphQLClientError(error: unknown): error is {response: {errors?: unknown; status?: number}} {
  if (!error || typeof error !== 'object' || !('response' in error)) return false
  const response = (error as {response?: unknown}).response
  return !!response && typeof response === 'object'
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
    if (isGraphQLClientError(error) && error.response.status === 401) {
      clearStoredStoreAppSession(input.context.session.store, input.context.session.userId)
      throw reauthenticateStoreAuthError(
        `Stored app authentication for ${input.context.session.store} is no longer valid.`,
        input.context.session.store,
        input.context.session.scopes.join(','),
      )
    }

    if (isGraphQLClientError(error) && error.response.errors) {
      throw new AbortError('GraphQL operation failed.', JSON.stringify({errors: error.response.errors}, null, 2))
    }

    throw error
  }
}
