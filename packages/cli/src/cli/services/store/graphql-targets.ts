import {BugError} from '@shopify/cli-kit/node/error'
import {PreparedStoreExecuteRequest} from './execute-request.js'
import {prepareAdminStoreGraphQLContext, AdminStoreGraphQLContext} from './admin-graphql-context.js'
import {runAdminStoreGraphQLOperation} from './admin-graphql-transport.js'

export type StoreGraphQLApi = 'admin'

interface PrepareStoreGraphQLTargetContextInput {
  store: string
  requestedVersion?: string
}

interface ExecuteStoreGraphQLTargetInput<TContext> {
  store: string
  context: TContext
  request: PreparedStoreExecuteRequest
}

// Internal seam for store-scoped GraphQL APIs. Different targets may need different
// auth/context preparation and execution behavior, so each target owns both phases.
interface StoreGraphQLTarget<TContext> {
  id: StoreGraphQLApi
  prepareContext(input: PrepareStoreGraphQLTargetContextInput): Promise<TContext>
  execute(input: ExecuteStoreGraphQLTargetInput<TContext>): Promise<unknown>
}

const adminStoreGraphQLTarget: StoreGraphQLTarget<AdminStoreGraphQLContext> = {
  id: 'admin',
  prepareContext: async ({store, requestedVersion}) => {
    return prepareAdminStoreGraphQLContext({store, userSpecifiedVersion: requestedVersion})
  },
  execute: async ({store, context, request}) => {
    return runAdminStoreGraphQLOperation({
      store,
      adminSession: context.adminSession,
      sessionUserId: context.sessionUserId,
      version: context.version,
      request,
    })
  },
}

export function getStoreGraphQLTarget(api: StoreGraphQLApi): StoreGraphQLTarget<AdminStoreGraphQLContext> {
  switch (api) {
    case 'admin':
      return adminStoreGraphQLTarget
    default:
      throw new BugError(`Unsupported store GraphQL API target: ${api satisfies never}`)
  }
}
