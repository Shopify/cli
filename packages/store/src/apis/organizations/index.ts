import {
  BulkDataStoreCopyStartResponse,
  BulkDataOperationByIdResponse,
  BulkDataStoreCopyStartInput,
  BulkDataStoreExportStartResponse,
  BulkDataStoreExportStartInput,
  BulkDataStoreImportStartResponse,
  BulkDataStoreImportStartInput,
} from './types.js'
import {
  bulkDataStoreCopyStartMutation,
  bulkDataOperationByIdQuery,
  bulkDataStoreExportStartMutation,
  bulkDataStoreImportStartMutation,
} from './graphql.js'
import {ResourceConfigs} from '../../lib/types.js'
import {GraphQLVariables, graphqlRequest, CacheOptions, UnauthorizedHandler} from '@shopify/cli-kit/node/api/graphql'
import {businessPlatformFqdn} from '@shopify/cli-kit/node/context/fqdn'

export type StoreIdentifier = {type: 'shop'; id: string} | {type: 'organization'; id: string}

export async function organizationsRequest<T>(
  identifier: StoreIdentifier,
  query: string,
  token: string,
  variables?: GraphQLVariables,
  cacheOptions?: CacheOptions,
  unauthorizedHandler?: UnauthorizedHandler,
): Promise<T> {
  const api = 'BusinessPlatform'
  const fqdn = await businessPlatformFqdn()
  const numericId = identifier.id.split('/').pop()
  const url = `https://${fqdn}/organizations/api/unstable/${identifier.type}/${numericId}/graphql`

  return graphqlRequest<T>({
    token,
    api,
    url,
    query,
    variables,
    cacheOptions,
    unauthorizedHandler,
  })
}

export async function startBulkDataStoreCopy(
  identifier: StoreIdentifier,
  sourceShopDomain: string,
  targetShopDomain: string,
  resourceConfigs: ResourceConfigs,
  token: string,
  unauthorizedHandler?: UnauthorizedHandler,
): Promise<BulkDataStoreCopyStartResponse> {
  const input: BulkDataStoreCopyStartInput = {
    sourceStoreIdentifier: {
      domain: sourceShopDomain,
    },
    targetStoreIdentifier: {
      domain: targetShopDomain,
    },
    resourceConfigs: Object.entries(resourceConfigs).reduce<{[key: string]: {identifier: {field: string}}}>(
      (acc, [resource, config]) => {
        acc[resource] = {
          identifier: {
            field: config.identifier.field ?? 'HANDLE',
          },
        }
        return acc
      },
      {},
    ),
  }

  return organizationsRequest<BulkDataStoreCopyStartResponse>(
    identifier,
    bulkDataStoreCopyStartMutation,
    token,
    {
      input,
    },
    undefined,
    unauthorizedHandler,
  )
}

export async function startBulkDataStoreExport(
  identifier: StoreIdentifier,
  sourceShopDomain: string,
  token: string,
  unauthorizedHandler?: UnauthorizedHandler,
): Promise<BulkDataStoreExportStartResponse> {
  const input: BulkDataStoreExportStartInput = {
    sourceStoreIdentifier: {
      domain: sourceShopDomain,
    },
  }

  return organizationsRequest<BulkDataStoreExportStartResponse>(
    identifier,
    bulkDataStoreExportStartMutation,
    token,
    {
      input,
    },
    undefined,
    unauthorizedHandler,
  )
}

export async function startBulkDataStoreImport(
  identifier: StoreIdentifier,
  targetShopDomain: string,
  importUrl: string,
  resourceConfigs: ResourceConfigs,
  token: string,
  unauthorizedHandler?: UnauthorizedHandler,
): Promise<BulkDataStoreImportStartResponse> {
  const input: BulkDataStoreImportStartInput = {
    targetStoreIdentifier: {
      domain: targetShopDomain,
    },
    importUrl,
    resourceConfigs: Object.entries(resourceConfigs).reduce<{[key: string]: {identifier: {field: string}}}>(
      (acc, [resource, config]) => {
        acc[resource] = {
          identifier: {
            field: config.identifier.field ?? 'HANDLE',
          },
        }
        return acc
      },
      {},
    ),
  }

  return organizationsRequest<BulkDataStoreImportStartResponse>(
    identifier,
    bulkDataStoreImportStartMutation,
    token,
    {
      input,
    },
    undefined,
    unauthorizedHandler,
  )
}

export async function pollBulkDataOperation(
  identifier: StoreIdentifier,
  operationId: string,
  token: string,
  unauthorizedHandler?: UnauthorizedHandler,
): Promise<BulkDataOperationByIdResponse> {
  return organizationsRequest<BulkDataOperationByIdResponse>(
    identifier,
    bulkDataOperationByIdQuery,
    token,
    {
      id: operationId,
    },
    {
      cacheTTL: {seconds: 0},
    },
    unauthorizedHandler,
  )
}
