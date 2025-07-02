import {ApiClientInterface} from '../types/api-client.js'
import {Organization, fetchOrgs} from '../../../apis/destinations/index.js'
import {
  BulkDataStoreCopyStartResponse,
  BulkDataOperationByIdResponse,
  BulkDataStoreExportStartResponse,
  BulkDataStoreImportStartResponse,
} from '../../../apis/organizations/types.js'
import {ResourceConfigs} from '../../../lib/types.js'
import {
  startBulkDataStoreCopy,
  startBulkDataStoreExport,
  startBulkDataStoreImport,
  pollBulkDataOperation,
  organizationsRequest,
} from '../../../apis/organizations/index.js'
import {bulkDataOperationByIdQuery} from '../../../apis/organizations/graphql.js'
import {ensureAuthenticatedBusinessPlatform} from '@shopify/cli-kit/node/session'
import {UnauthorizedHandler} from '@shopify/cli-kit/node/api/graphql'

export class ApiClient implements ApiClientInterface {
  async fetchOrganizations(session: string): Promise<Organization[]> {
    const orgs = await fetchOrgs(session, this.createUnauthorizedHandler())
    return orgs.filter((org) => org.shops.length > 1)
  }

  async startBulkDataStoreCopy(
    organizationId: string,
    sourceShopDomain: string,
    targetShopDomain: string,
    resourceConfigs: ResourceConfigs,
    token: string,
  ): Promise<BulkDataStoreCopyStartResponse> {
    return startBulkDataStoreCopy(
      organizationId,
      sourceShopDomain,
      targetShopDomain,
      resourceConfigs,
      token,
      this.createUnauthorizedHandler(),
    )
  }

  async startBulkDataStoreExport(
    organizationId: string,
    sourceShopDomain: string,
    token: string,
  ): Promise<BulkDataStoreExportStartResponse> {
    return startBulkDataStoreExport(organizationId, sourceShopDomain, token, this.createUnauthorizedHandler())
  }

  async startBulkDataStoreImport(
    organizationId: string,
    targetShopDomain: string,
    importUrl: string,
    resourceConfigs: ResourceConfigs,
    token: string,
  ): Promise<BulkDataStoreImportStartResponse> {
    return startBulkDataStoreImport(
      organizationId,
      targetShopDomain,
      importUrl,
      resourceConfigs,
      token,
      this.createUnauthorizedHandler(),
    )
  }

  async pollBulkDataOperation(
    organizationId: string,
    operationId: string,
    token: string,
  ): Promise<BulkDataOperationByIdResponse> {
    return pollBulkDataOperation(organizationId, operationId, token, this.createUnauthorizedHandler())
  }

  async ensureAuthenticatedBusinessPlatform(): Promise<string> {
    return ensureAuthenticatedBusinessPlatform()
  }

  async ensureUserHasBulkDataAccess(organizationId: string, token: string): Promise<boolean> {
    try {
      const fakeOperationId = 'Z2lkOi8vb3JnYW5pemF0aW9uL0J1bGtEYXRhT3BlcmF0aW9uLzg5'
      await organizationsRequest<BulkDataOperationByIdResponse>(
        organizationId,
        bulkDataOperationByIdQuery,
        token,
        {id: fakeOperationId},
        undefined,
        this.createUnauthorizedHandler(),
      )

      return true
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes('does not exist on type') || error.message.includes('BulkDataOperationById'))
      ) {
        return false
      }
      if (error instanceof Error && error.message.includes('BulkDataOperation not found')) {
        return true
      }
      throw error
    }
  }

  private createUnauthorizedHandler(): UnauthorizedHandler {
    return {
      type: 'token_refresh',
      handler: async () => {
        const newToken = await this.ensureAuthenticatedBusinessPlatform()
        return {token: newToken}
      },
    }
  }
}
