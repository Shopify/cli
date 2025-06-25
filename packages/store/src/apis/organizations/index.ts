import {BulkDataStoreCopyStartResponse, BulkDataOperationByIdResponse, BulkDataStoreCopyStartInput} from './types.js'
import {bulkDataStoreCopyStartMutation, bulkDataOperationByIdQuery} from './graphql.js'
import {ResourceConfigs} from '../../lib/types.js'
import {GraphQLVariables, graphqlRequest, CacheOptions} from '@shopify/cli-kit/node/api/graphql'
import {businessPlatformFqdn} from '@shopify/cli-kit/node/context/fqdn'

export async function organizationsRequest<T>(
  organizationId: string,
  query: string,
  token: string,
  variables?: GraphQLVariables,
  cacheOptions?: CacheOptions,
): Promise<T> {
  const api = 'BusinessPlatform'
  const fqdn = await businessPlatformFqdn()
  const decodedOrganizationGid = Buffer.from(organizationId, 'base64').toString('utf-8')
  const numericOrganizationId = decodedOrganizationGid.split('/').pop()
  const url = `https://${fqdn}/organizations/api/unstable/organization/${numericOrganizationId}/graphql`

  return graphqlRequest<T>({
    token,
    api,
    url,
    query,
    variables,
    cacheOptions,
  })
}

export async function startBulkDataStoreCopy(
  organizationId: string,
  sourceShopDomain: string,
  targetShopDomain: string,
  resourceConfigs: ResourceConfigs,
  token: string,
): Promise<BulkDataStoreCopyStartResponse> {
  const input: BulkDataStoreCopyStartInput = {
    sourceStoreIdentifier: {
      domain: sourceShopDomain,
    },
    targetStoreIdentifier: {
      domain: targetShopDomain,
    },
    resourceConfigs: Object.entries(resourceConfigs).reduce((acc, [resource, config]) => {
      acc[resource] = {
        identifier: {
          field: config.identifier.field || 'HANDLE',
        },
      }
      return acc
    }, {} as {[key: string]: {identifier: {field: string}}}),
  }

  return organizationsRequest<BulkDataStoreCopyStartResponse>(organizationId, bulkDataStoreCopyStartMutation, token, {
    input,
  })
}

export async function pollBulkDataOperation(
  organizationId: string,
  operationId: string,
  token: string,
): Promise<BulkDataOperationByIdResponse> {
  return organizationsRequest<BulkDataOperationByIdResponse>(organizationId, bulkDataOperationByIdQuery, token, {
    id: operationId,
  })
}
