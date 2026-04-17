import {prepareAdminStoreGraphQLContext, type AdminStoreGraphQLContext} from './admin-context.js'
import {runAdminStoreGraphQLOperation} from './admin-transport.js'
import {BugError} from '@shopify/cli-kit/node/error'
import type {PreparedStoreExecuteRequest} from './request.js'

export type StoreGraphQLApi = 'admin'

interface PrepareStoreGraphQLTargetContextInput {
  store: string
  requestedVersion?: string
}

interface ExecuteStoreGraphQLTargetInput<TContext> {
  context: TContext
  request: PreparedStoreExecuteRequest
}

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
  execute: async ({context, request}) => {
    return runAdminStoreGraphQLOperation({context, request})
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
