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

export async function organizationsRequest<T>(
  shopId: string,
  query: string,
  token: string,
  variables?: GraphQLVariables,
  cacheOptions?: CacheOptions,
  unauthorizedHandler?: UnauthorizedHandler,
): Promise<T> {
  const api = 'BusinessPlatform'
  const fqdn = await businessPlatformFqdn()
  const numericShopId = shopId.split('/').pop()
  const url = `https://${fqdn}/organizations/api/unstable/shop/${numericShopId}/graphql`

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
  shopId: string,
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
    shopId,
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
  shopId: string,
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
    shopId,
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
  shopId: string,
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
    shopId,
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
  shopId: string,
  operationId: string,
  token: string,
  unauthorizedHandler?: UnauthorizedHandler,
): Promise<BulkDataOperationByIdResponse> {
  return organizationsRequest<BulkDataOperationByIdResponse>(
    shopId,
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
