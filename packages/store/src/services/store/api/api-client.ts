import {ApiClientInterface} from '../types/api-client.js'
import {Organization} from '../../../apis/destinations/types.js'
import {BulkDataStoreCopyStartResponse, BulkDataOperationByIdResponse} from '../../../apis/organizations/types.js'
import {ResourceConfigs} from '../../../lib/types.js'
import {fetchOrgs} from '../../../apis/destinations/index.js'
import {startBulkDataStoreCopy, pollBulkDataOperation} from '../../../apis/organizations/index.js'
import {ensureAuthenticatedBusinessPlatform} from '@shopify/cli-kit/node/session'

export class ApiClient implements ApiClientInterface {
  async fetchOrganizations(session: string): Promise<Organization[]> {
    const orgs = await fetchOrgs(session)
    return orgs.filter((org) => org.shops.length > 1)
  }

  async startBulkDataStoreCopy(
    organizationId: string,
    sourceShopDomain: string,
    targetShopDomain: string,
    resourceConfigs: ResourceConfigs,
    token: string,
  ): Promise<BulkDataStoreCopyStartResponse> {
    return startBulkDataStoreCopy(organizationId, sourceShopDomain, targetShopDomain, resourceConfigs, token)
  }

  async pollBulkDataOperation(
    organizationId: string,
    operationId: string,
    token: string,
  ): Promise<BulkDataOperationByIdResponse> {
    return pollBulkDataOperation(organizationId, operationId, token)
  }

  async ensureAuthenticatedBusinessPlatform(): Promise<string> {
    return ensureAuthenticatedBusinessPlatform()
  }
}
