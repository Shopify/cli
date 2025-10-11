/* eslint-disable @typescript-eslint/no-non-null-assertion */

import {ListOrganizations} from '../api/graphql/business-platform-destinations/generated/organizations.js'
import {UserInfo} from '../api/graphql/business-platform-destinations/generated/user-info.js'
import {
  ListAppDevStores,
  ListAppDevStoresQuery,
} from '../api/graphql/business-platform-organizations/generated/list_app_dev_stores.js'
import {CreateAppDevelopmentStore} from '../api/graphql/business-platform-organizations/generated/create_app_development_store.js'
import {
  OrganizationShopStatusQuery,
  OrganizationShopStatusQueryQuery,
} from '../api/graphql/business-platform-organizations/generated/poll_dev_store_status.js'
import {
  PublishedDeveloperPreviewsQuery,
  PublishedDeveloperPreviewsQueryQuery,
} from '../api/graphql/business-platform-organizations/generated/published_developer_previews.js'
import {DeleteDevStore} from '../api/graphql/dev-stores/generated/delete_dev_store.js'
import {getPartnersToken} from '@shopify/cli-kit/node/environment'
import {ensureAuthenticatedAppManagementAndBusinessPlatform} from '@shopify/cli-kit/node/session'
import {isUnitTest} from '@shopify/cli-kit/node/context/local'
import {AbortError, BugError} from '@shopify/cli-kit/node/error'
import {
  businessPlatformOrganizationsRequestDoc,
  BusinessPlatformOrganizationsRequestOptions,
  businessPlatformRequestDoc,
  BusinessPlatformRequestOptions,
} from '@shopify/cli-kit/node/api/business-platform'
import {UnauthorizedHandler} from '@shopify/cli-kit/node/api/graphql'
import {Variables} from 'graphql-request'
import {devStoresRequestDoc, DevStoresRequestOptions} from '@shopify/cli-kit/node/api/dev-store'

type OrgType = NonNullable<ListAppDevStoresQuery['organization']>
type AccessibleShops = NonNullable<OrgType['accessibleShops']>
type ShopEdge = NonNullable<AccessibleShops['edges'][number]>
type ShopNode = Exclude<ShopEdge['node'], {[key: string]: never}>
enum OrganizationSource {
  BusinessPlatform = 'BusinessPlatform',
}

interface Organization {
  id: string
  businessName: string
  source: OrganizationSource
}

export interface OrganizationStore {
  shopId: string
  link: string
  shopDomain: string
  shopName: string
  transferDisabled: boolean
  convertableToPartnerTest: boolean
  provisionable: boolean
}

type Paginateable<T> = T & {
  hasMorePages: boolean
}

interface Session {
  token: string
  businessPlatformToken: string
  accountInfo: {
    type: 'ServiceAccount' | 'UserAccount' | 'UnknownAccount'
    orgName?: string
    email?: string
  }
  userId: string
}
const inProgressRefreshes = new WeakMap<AppDevStoreClient, Promise<string>>()

export class AppDevStoreClient {
  private _session: Session | undefined

  async session(): Promise<Session> {
    if (!this._session) {
      if (isUnitTest()) {
        throw new Error('AppManagementClient.session() should not be invoked dynamically in a unit test')
      }

      const tokenResult = await ensureAuthenticatedAppManagementAndBusinessPlatform()
      const {appManagementToken, businessPlatformToken, userId} = tokenResult

      // This one can't use the shared businessPlatformRequest because the token is not globally available yet.
      const userInfoResult = await businessPlatformRequestDoc({
        query: UserInfo,
        cacheOptions: {
          cacheTTL: {hours: 6},
          cacheExtraKey: userId,
        },
        token: businessPlatformToken,
        unauthorizedHandler: this.createUnauthorizedHandler(),
      })

      if (getPartnersToken() && userInfoResult.currentUserAccount) {
        const organizations = userInfoResult.currentUserAccount.organizations.nodes.map((org) => ({
          name: org.name,
        }))

        if (organizations.length > 1) {
          throw new BugError('Multiple organizations found for the CLI token')
        }

        this._session = {
          token: appManagementToken,
          businessPlatformToken,
          accountInfo: {
            type: 'ServiceAccount',
            orgName: organizations[0]?.name ?? 'Unknown organization',
          },
          userId,
        }
      } else if (userInfoResult.currentUserAccount) {
        this._session = {
          token: appManagementToken,
          businessPlatformToken,
          accountInfo: {
            type: 'UserAccount',
            email: userInfoResult.currentUserAccount.email,
          },
          userId,
        }
      } else {
        this._session = {
          token: appManagementToken,
          businessPlatformToken,
          accountInfo: {
            type: 'UnknownAccount',
          },
          userId,
        }
      }
    }
    return this._session
  }

  async token(): Promise<string> {
    return (await this.session()).token
  }

  async businessPlatformToken(): Promise<string> {
    return (await this.session()).businessPlatformToken
  }

  async devStoreToken(): Promise<string> {
    return (await this.session()).token
  }

  async unsafeRefreshToken(): Promise<string> {
    const result = await ensureAuthenticatedAppManagementAndBusinessPlatform({noPrompt: true, forceRefresh: true})
    const session = await this.session()
    session.token = result.appManagementToken
    session.businessPlatformToken = result.businessPlatformToken

    return session.token
  }

  async organizations(): Promise<Organization[]> {
    const organizationsResult = await this.businessPlatformRequest({query: ListOrganizations})
    if (!organizationsResult.currentUserAccount) return []
    const orgs = organizationsResult.currentUserAccount.organizationsWithAccessToDestination.nodes
    const uniqueNames = new Set(orgs.map((org) => org.name))
    const duplicatedNames = uniqueNames.size < orgs.length
    return orgs
      .map((org) => ({
        id: idFromEncodedGid(org.id),
        businessName: duplicatedNames ? `${org.name} (${idFromEncodedGid(org.id)})` : org.name,
        source: OrganizationSource.BusinessPlatform,
      }))
      .filter((org) => org)
  }

  // we are returning OrganizationStore type here because we want to keep types consistent btwn
  // partners-client and app-management-client. Since we need transferDisabled and convertableToPartnerTest values
  // from the Partners OrganizationStore schema, we will return this type for now
  async devStoresForOrg(orgId: string, searchTerm?: string): Promise<Paginateable<{stores: OrganizationStore[]}>> {
    const storesResult = await this.businessPlatformOrganizationsRequest({
      query: ListAppDevStores,
      organizationId: String(numberFromGid(orgId)),
      variables: {searchTerm},
    })
    const organization = storesResult.organization

    if (!organization) {
      throw new AbortError(`No organization found`)
    }

    const shopArray = organization.accessibleShops?.edges.map((value) => value.node) ?? []
    const provisionable = isStoreProvisionable(organization.currentUser?.organizationPermissions ?? [])
    return {
      stores: mapBusinessPlatformStoresToOrganizationStores(shopArray, provisionable),
      hasMorePages: storesResult.organization?.accessibleShops?.pageInfo.hasNextPage ?? false,
    }
  }

  async createDevStore(orgId: string, developerPreviewHandle?: string): Promise<OrganizationStore> {
    const storesResult = await this.businessPlatformOrganizationsRequest({
      query: CreateAppDevelopmentStore,
      organizationId: orgId,
      variables: {
        shopName: 'New Store',
        developerPreviewHandle: developerPreviewHandle ?? 'new_markets',
        prepopulateTestData: false,
        priceLookupKey: 'SHOPIFY_PLUS_APP_DEVELOPMENT',
      },
    })
    const storeCreation = storesResult.createAppDevelopmentStore

    if (!storeCreation) {
      throw new AbortError(`No store created`)
    }

    return {
      shopId: '',
      link: storeCreation.shopAdminUrl ?? '',
      shopDomain: storeCreation.shopDomain ?? '',
      shopName: 'New Store',
      transferDisabled: true,
      convertableToPartnerTest: true,
      provisionable: true,
    }
  }

  async getStoreStatus(orgId: string, shopDomain: string): Promise<OrganizationShopStatusQueryQuery> {
    const result = await this.businessPlatformOrganizationsRequest({
      query: OrganizationShopStatusQuery,
      organizationId: orgId,
      variables: {shopDomain},
    })
    return result
  }

  async getDeveloperPreviews(orgId: string): Promise<PublishedDeveloperPreviewsQueryQuery> {
    const result = await this.businessPlatformOrganizationsRequest({
      query: PublishedDeveloperPreviewsQuery,
      organizationId: orgId,
    })
    return result
  }

  // async storeByDomain(orgId: string, shopDomain: string): Promise<OrganizationStore | undefined> {
  //   const queryVariables: FetchDevStoreByDomainQueryVariables = {domain: shopDomain}
  //   const storesResult = await this.businessPlatformOrganizationsRequest({
  //     query: FetchDevStoreByDomain,
  //     organizationId: String(numberFromGid(orgId)),
  //     variables: queryVariables,
  //   })

  //   const organization = storesResult.organization

  //   if (!organization) {
  //     throw new AbortError(`No organization found`)
  //   }

  //   const bpStoresArray = organization.accessibleShops?.edges.map((value) => value.node) ?? []
  //   const provisionable = isStoreProvisionable(organization.currentUser?.organizationPermissions ?? [])
  //   const storesArray = mapBusinessPlatformStoresToOrganizationStores(bpStoresArray, provisionable)
  //   return storesArray[0]
  // }

  // async ensureUserAccessToStore(orgId: string, store: OrganizationStore): Promise<void> {
  //   if (!store.provisionable) {
  //     return
  //   }
  //   const encodedShopId = encodedGidFromShopId(store.shopId)
  //   const variables: ProvisionShopAccessMutationVariables = {
  //     input: {shopifyShopId: encodedShopId},
  //   }

  //   const fullResult = await businessPlatformOrganizationsRequestDoc({
  //     query: ProvisionShopAccess,
  //     token: await this.businessPlatformToken(),
  //     organizationId: String(numberFromGid(orgId)),
  //     variables,
  //     unauthorizedHandler: this.createUnauthorizedHandler(),
  //   })
  //   const provisionResult = fullResult.organizationUserProvisionShopAccess
  //   if (!provisionResult.success) {
  //     const errorMessages = provisionResult.userErrors?.map((error) => error.message).join(', ') ?? ''
  //     throw new BugError(`Failed to provision user access to store: ${errorMessages}`)
  //   }
  // }

  // async convertToTransferDisabledStore(
  //   _input: ConvertDevToTransferDisabledStoreVariables,
  // ): Promise<ConvertDevToTransferDisabledSchema> {
  //   throw new BugError('Not implemented: convertToTransferDisabledStore')
  // }

  async deleteDevStore(orgId: string, shopFqdn: string): Promise<OrganizationStore> {
    const storesResult = await this.devStoresRequest({
      query: DeleteDevStore,
      shopFqdn,
      variables: {
        organizationId: orgId,
      },
    })
    const storeCreation = storesResult.devStoreDelete

    if (!storeCreation) {
      throw new AbortError(`No store created`)
    }

    return {
      shopId: '',
      link: '',
      shopDomain: '',
      shopName: 'New Store',
      transferDisabled: true,
      convertableToPartnerTest: true,
      provisionable: true,
    }
  }

  toExtensionGraphQLType(input: string) {
    return input.toLowerCase()
  }

  private async businessPlatformRequest<TResult, TVariables extends Variables>(
    options: Omit<BusinessPlatformRequestOptions<TResult, TVariables>, 'unauthorizedHandler' | 'token'>,
  ): Promise<TResult> {
    return businessPlatformRequestDoc({
      ...options,
      token: await this.businessPlatformToken(),
      unauthorizedHandler: this.createUnauthorizedHandler(),
    })
  }

  private async businessPlatformOrganizationsRequest<TResult, TVariables extends Variables>(
    options: Omit<BusinessPlatformOrganizationsRequestOptions<TResult, TVariables>, 'unauthorizedHandler' | 'token'>,
  ): Promise<TResult> {
    return businessPlatformOrganizationsRequestDoc({
      ...options,
      token: await this.businessPlatformToken(),
      unauthorizedHandler: this.createUnauthorizedHandler(),
    })
  }

  private async devStoresRequest<TResult, TVariables extends Variables>(
    options: Omit<DevStoresRequestOptions<TResult, TVariables>, 'unauthorizedHandler' | 'token'>,
  ): Promise<TResult> {
    return devStoresRequestDoc({
      ...options,
      token: await this.devStoreToken(),
      unauthorizedHandler: this.createUnauthorizedHandler(),
    })
  }

  private createUnauthorizedHandler(): UnauthorizedHandler {
    return {
      type: 'token_refresh',
      handler: async () => {
        let tokenRefresher = inProgressRefreshes.get(this)
        if (tokenRefresher) {
          const token = await tokenRefresher
          return {token}
        } else {
          try {
            tokenRefresher = this.unsafeRefreshToken()
            inProgressRefreshes.set(this, tokenRefresher)
            const token = await tokenRefresher
            return {token}
          } finally {
            inProgressRefreshes.delete(this)
          }
        }
      },
    }
  }
}

// Business platform uses base64-encoded GIDs, while App Management uses
// just the integer portion of that ID. These functions convert between the two.

// 1234 => gid://organization/Organization/1234 => base64
export function encodedGidFromOrganizationIdForBP(id: string): string {
  const num = id.startsWith('gid://') ? numberFromGid(id) : Number(id)
  const gid = `gid://organization/Organization/${num}`
  return Buffer.from(gid).toString('base64')
}

export function gidFromOrganizationIdForShopify(id: string): string {
  const num = id.startsWith('gid://') ? numberFromGid(id) : Number(id)
  return `gid://shopify/Organization/${num}`
}

// 1234 => gid://organization/ShopifyShop/1234 => base64
export function encodedGidFromShopId(id: string): string {
  const gid = `gid://organization/ShopifyShop/${id}`
  return Buffer.from(gid).toString('base64')
}

// 1234 => gid://shopify/Shop/1234
export function gidFromShopIdForShopify(id: string): string {
  const num = id.startsWith('gid://') ? numberFromGid(id) : Number(id)
  return `gid://shopify/Shop/${num}`
}

// base64 => gid://organization/Organization/1234 => 1234
function idFromEncodedGid(gid: string): string {
  const decodedGid = Buffer.from(gid, 'base64').toString('ascii')
  return numberFromGid(decodedGid).toString()
}

// gid://organization/Organization/1234 => 1234
function numberFromGid(gid: string): number {
  if (gid.startsWith('gid://')) {
    return Number(gid.match(/^gid.*\/(\d+)$/)![1])
  }
  return Number(gid)
}

function mapBusinessPlatformStoresToOrganizationStores(
  storesArray: ShopNode[],
  provisionable: boolean,
): OrganizationStore[] {
  return storesArray.map((store: ShopNode) => {
    const {externalId, primaryDomain, name} = store
    return {
      shopId: externalId ? idFromEncodedGid(externalId) : undefined,
      link: primaryDomain,
      shopDomain: primaryDomain,
      shopName: name,
      transferDisabled: true,
      convertableToPartnerTest: true,
      provisionable,
    } as OrganizationStore
  })
}

function isStoreProvisionable(permissions: string[]) {
  return permissions.includes('ondemand_access_to_stores')
}
