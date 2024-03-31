import {
  CreateAppMutation,
  CreateAppMutationVariables,
  CreateAppMutationSchema,
} from './shopify-developers-client/graphql/create-app.js'
import {
  ActiveAppReleaseQuery,
  ActiveAppReleaseQueryVariables,
  ActiveAppReleaseQuerySchema,
} from './shopify-developers-client/graphql/active-app-release.js'
import {
  SpecificationsQuery,
  SpecificationsQueryVariables,
  SpecificationsQuerySchema,
} from './shopify-developers-client/graphql/specifications.js'
import {
  CreateAppVersionMutation,
  CreateAppVersionMutationSchema,
  CreateAppVersionMutationVariables,
} from './shopify-developers-client/graphql/create-app-version.js'
import {
  ReleaseVersionMutation,
  ReleaseVersionMutationSchema,
  ReleaseVersionMutationVariables,
} from './shopify-developers-client/graphql/release-version.js'
import {OrganizationsQuery, OrganizationsQuerySchema} from './shopify-developers-client/graphql/organizations.js'
import {AppsQuery, AppsQuerySchema, MinimalAppModule} from './shopify-developers-client/graphql/apps.js'
import {
  OrganizationQuery,
  OrganizationQuerySchema,
  OrganizationQueryVariables,
} from './shopify-developers-client/graphql/organization.js'
import {UserInfoQuery, UserInfoQuerySchema} from './shopify-developers-client/graphql/user-info.js'
import {
  CreateAssetURLMutation,
  CreateAssetURLMutationSchema,
  CreateAssetURLMutationVariables,
} from './shopify-developers-client/graphql/create-asset-url.js'
import {RemoteSpecification} from '../../api/graphql/extension_specifications.js'
import {
  DeveloperPlatformClient,
  Paginateable,
  ActiveAppVersion,
  AppDeployOptions,
  AssetUrlSchema,
} from '../developer-platform-client.js'
import {PartnersSession} from '../../../cli/services/context/partner-account-info.js'
import {
  MinimalAppIdentifiers,
  MinimalOrganizationApp,
  Organization,
  OrganizationApp,
  OrganizationStore,
} from '../../models/organization.js'
import {filterDisabledFlags} from '../../../cli/services/dev/fetch.js'
import {AllAppExtensionRegistrationsQuerySchema} from '../../api/graphql/all_app_extension_registrations.js'
import {ExtensionUpdateDraftInput, ExtensionUpdateSchema} from '../../api/graphql/update_draft.js'
import {AppDeploySchema} from '../../api/graphql/app_deploy.js'
import {FindStoreByDomainSchema} from '../../api/graphql/find_store_by_domain.js'
import {AppVersionsQuerySchema} from '../../api/graphql/get_versions_list.js'
import {ExtensionCreateSchema, ExtensionCreateVariables} from '../../api/graphql/extension_create.js'
import {
  ConvertDevToTestStoreSchema,
  ConvertDevToTestStoreVariables,
} from '../../api/graphql/convert_dev_to_test_store.js'
import {FindAppPreviewModeSchema, FindAppPreviewModeVariables} from '../../api/graphql/find_app_preview_mode.js'
import {
  DevelopmentStorePreviewUpdateInput,
  DevelopmentStorePreviewUpdateSchema,
} from '../../api/graphql/development_preview.js'
import {AppReleaseSchema, AppReleaseVariables} from '../../api/graphql/app_release.js'
import {AppVersionByTagSchema, AppVersionByTagVariables} from '../../api/graphql/app_version_by_tag.js'
import {AppVersionsDiffSchema, AppVersionsDiffVariables} from '../../api/graphql/app_versions_diff.js'
import {SendSampleWebhookSchema, SendSampleWebhookVariables} from '../../services/webhook/request-sample.js'
import {PublicApiVersionsSchema} from '../../services/webhook/request-api-versions.js'
import {WebhookTopicsSchema, WebhookTopicsVariables} from '../../services/webhook/request-topics.js'
import {
  MigrateFlowExtensionSchema,
  MigrateFlowExtensionVariables,
} from '../../api/graphql/extension_migrate_flow_extension.js'
import {UpdateURLsSchema, UpdateURLsVariables} from '../../api/graphql/update_urls.js'
import {CurrentAccountInfoSchema} from '../../api/graphql/current_account_info.js'
import {ExtensionTemplate} from '../../models/app/template.js'
import {TargetSchemaDefinitionQueryVariables} from '../../api/graphql/functions/target_schema_definition.js'
import {ApiSchemaDefinitionQueryVariables} from '../../api/graphql/functions/api_schema_definition.js'
import {
  MigrateToUiExtensionVariables,
  MigrateToUiExtensionSchema,
} from '../../api/graphql/extension_migrate_to_ui_extension.js'
import {MigrateAppModuleSchema, MigrateAppModuleVariables} from '../../api/graphql/extension_migrate_app_module.js'
import {FunctionUploadUrlGenerateResponse} from '@shopify/cli-kit/node/api/partners'
import {isUnitTest} from '@shopify/cli-kit/node/context/local'
import {AbortError, BugError} from '@shopify/cli-kit/node/error'
import {orgScopedShopifyDevelopersRequest} from '@shopify/cli-kit/node/api/shopify-developers'
import {underscore} from '@shopify/cli-kit/common/string'
import {ensureAuthenticatedBusinessPlatform} from '@shopify/cli-kit/node/session'
import {businessPlatformRequest} from '@shopify/cli-kit/node/api/business-platform'
import {shopifyDevelopersFqdn} from '@shopify/cli-kit/node/context/fqdn'

export class ShopifyDevelopersClient implements DeveloperPlatformClient {
  public requiresOrganization = true
  public supportsAtomicDeployments = true
  private _session: PartnersSession | undefined
  private _businessPlatformToken: string | undefined

  constructor(session?: PartnersSession) {
    this._session = session
  }

  async session(): Promise<PartnersSession> {
    if (!this._session) {
      if (isUnitTest()) {
        throw new Error('ShopifyDevelopersClient.session() should not be invoked dynamically in a unit test')
      }
      const userInfoResult = await businessPlatformRequest<UserInfoQuerySchema>(
        UserInfoQuery,
        await this.businessPlatformToken(),
      )
      const email = userInfoResult.currentUserAccount.email
      this._session = {
        // Need to replace with actual auth token for developer platform
        token: 'token',
        accountInfo: {
          type: 'UserAccount',
          email,
        },
      }
    }
    return this._session
  }

  async token(): Promise<string> {
    return (await this.session()).token
  }

  async refreshToken(): Promise<string> {
    return this.token()
  }

  async businessPlatformToken(): Promise<string> {
    if (isUnitTest()) {
      throw new Error(
        'ShopifyDevelopersClient.businessPlatformToken() should not be invoked dynamically in a unit test',
      )
    }
    if (!this._businessPlatformToken) {
      this._businessPlatformToken = await ensureAuthenticatedBusinessPlatform()
    }
    return this._businessPlatformToken
  }

  async accountInfo(): Promise<PartnersSession['accountInfo']> {
    return (await this.session()).accountInfo
  }

  async appFromId(appIdentifiers: MinimalAppIdentifiers): Promise<OrganizationApp | undefined> {
    const {app} = await this.fetchApp(appIdentifiers)
    const {modules} = app.activeRelease.version
    const brandingModule = modules.find((mod) => mod.specification.externalIdentifier === 'branding')!
    const appAccessModule = modules.find((mod) => mod.specification.externalIdentifier === 'app_access')!
    return {
      id: app.id,
      title: brandingModule.config.name as string,
      apiKey: app.id,
      organizationId: appIdentifiers.organizationId,
      apiSecretKeys: [],
      grantedScopes: appAccessModule.config.scopes as string[],
      flags: [],
    }
  }

  async organizations(): Promise<Organization[]> {
    const organizationsResult = await businessPlatformRequest<OrganizationsQuerySchema>(
      OrganizationsQuery,
      await this.businessPlatformToken(),
    )
    return organizationsResult.currentUserAccount.organizations.nodes.map((org) => ({
      id: idFromEncodedGid(org.id),
      businessName: org.name,
    }))
  }

  async orgFromId(orgId: string): Promise<Organization | undefined> {
    const base64Id = encodedGidFromId(orgId)
    const variables: OrganizationQueryVariables = {organizationId: base64Id}
    const organizationResult = await businessPlatformRequest<OrganizationQuerySchema>(
      OrganizationQuery,
      await this.businessPlatformToken(),
      variables,
    )
    const org = organizationResult.currentUserAccount.organization
    if (!org) {
      return
    }
    return {
      id: orgId,
      businessName: org.name,
    }
  }

  async orgAndApps(
    organizationId: string,
  ): Promise<Paginateable<{organization: Organization; apps: MinimalOrganizationApp[]}>> {
    const [organization, {apps, hasMorePages}] = await Promise.all([
      this.orgFromId(organizationId),
      this.appsForOrg(organizationId),
    ])
    return {organization: organization!, apps, hasMorePages}
  }

  async appsForOrg(organizationId: string, _term?: string): Promise<Paginateable<{apps: MinimalOrganizationApp[]}>> {
    const query = AppsQuery
    const result = await orgScopedShopifyDevelopersRequest<AppsQuerySchema>(organizationId, query, await this.token())
    const minimalOrganizationApps = result.apps.map((app) => {
      const brandingConfig = app.activeRelease.version.modules.find(
        (mod: MinimalAppModule) => mod.specification.externalIdentifier === 'branding',
      )!.config
      return {
        id: app.id,
        apiKey: app.id,
        title: brandingConfig.name as string,
        organizationId,
      }
    })
    return {
      apps: minimalOrganizationApps,
      hasMorePages: false,
    }
  }

  async specifications({id: appId, organizationId}: MinimalAppIdentifiers): Promise<RemoteSpecification[]> {
    // This should be the actual query, but it's not working at the moment...
    const query = SpecificationsQuery
    const variables: SpecificationsQueryVariables = {appId}
    const result = await orgScopedShopifyDevelopersRequest<SpecificationsQuerySchema>(
      organizationId,
      query,
      await this.token(),
      variables,
    )
    return result.specifications
      .filter((spec) => spec.experience !== 'DEPRECATED')
      .map(
        (spec): RemoteSpecification => ({
          name: spec.name,
          externalName: spec.name,
          identifier: spec.externalIdentifier,
          externalIdentifier: spec.externalIdentifier,
          gated: false,
          options: {
            managementExperience: 'cli',
            registrationLimit: 1,
          },
          experience: spec.experience.toLowerCase() as 'extension' | 'configuration',
        }),
      )
  }

  async templateSpecifications(_appId: string): Promise<ExtensionTemplate[]> {
    return stubbedExtensionTemplates()
  }

  async createApp(
    org: Organization,
    name: string,
    options?: {
      isLaunchable?: boolean
      scopesArray?: string[]
      directory?: string
    },
  ): Promise<OrganizationApp> {
    const variables = createAppVars(name, options?.isLaunchable, options?.scopesArray)

    const mutation = CreateAppMutation
    const result = await orgScopedShopifyDevelopersRequest<CreateAppMutationSchema>(
      org.id,
      mutation,
      await this.token(),
      variables,
    )
    if (result.appCreate.userErrors?.length > 0) {
      const errors = result.appCreate.userErrors.map((error) => error.message).join(', ')
      throw new AbortError(errors)
    }

    // Need to figure this out still
    const flags = filterDisabledFlags([])
    const createdApp = result.appCreate.app
    return {
      ...createdApp,
      title: name,
      apiKey: createdApp.id,
      apiSecretKeys: [],
      grantedScopes: options?.scopesArray ?? [],
      organizationId: org.id,
      newApp: true,
      flags,
    }
  }

  async devStoresForOrg(_orgId: string): Promise<OrganizationStore[]> {
    return []
  }

  async appExtensionRegistrations(
    appIdentifiers: MinimalAppIdentifiers,
  ): Promise<AllAppExtensionRegistrationsQuerySchema> {
    const {app} = await this.fetchApp(appIdentifiers)
    const {modules} = app.activeRelease.version
    return {
      app: {
        extensionRegistrations: [],
        dashboardManagedExtensionRegistrations: [],
        configurationRegistrations: modules
          .filter((mod) => mod.specification.experience === 'CONFIGURATION')
          .map((mod) => ({
            id: mod.uid,
            uuid: mod.uid,
            title: mod.specification.name,
            type: mod.specification.externalIdentifier,
          })),
      },
    }
  }

  async appVersions(_appId: string): Promise<AppVersionsQuerySchema> {
    throw new BugError('Not implemented: appVersions')
  }

  async appVersionByTag(_input: AppVersionByTagVariables): Promise<AppVersionByTagSchema> {
    throw new BugError('Not implemented: appVersions')
  }

  async appVersionsDiff(_input: AppVersionsDiffVariables): Promise<AppVersionsDiffSchema> {
    throw new BugError('Not implemented: appVersions')
  }

  async activeAppVersion({id, organizationId}: MinimalAppIdentifiers): Promise<ActiveAppVersion> {
    const query = ActiveAppReleaseQuery
    const variables: ActiveAppReleaseQueryVariables = {appId: id}
    const result = await orgScopedShopifyDevelopersRequest<ActiveAppReleaseQuerySchema>(
      organizationId,
      query,
      await this.token(),
      variables,
    )
    return {
      appModuleVersions: result.app.activeRelease.version.modules.map((mod) => {
        return {
          registrationId: mod.gid,
          registrationUid: mod.uid,
          registrationTitle: mod.handle,
          type: mod.specification.externalIdentifier,
          config: mod.config,
          specification: {
            ...mod.specification,
            identifier: mod.specification.externalIdentifier,
            options: {managementExperience: 'cli'},
            experience: mod.specification.experience.toLowerCase() as 'configuration' | 'extension' | 'deprecated',
          },
        }
      }),
      ...result.app.activeRelease,
    }
  }

  async functionUploadUrl(): Promise<FunctionUploadUrlGenerateResponse> {
    throw new BugError('Not implemented: functionUploadUrl')
  }

  async generateSignedUploadUrl({organizationId, apiKey}: MinimalAppIdentifiers): Promise<AssetUrlSchema> {
    const variables: CreateAssetURLMutationVariables = {appId: apiKey}
    const result = await orgScopedShopifyDevelopersRequest<CreateAssetURLMutationSchema>(
      organizationId,
      CreateAssetURLMutation,
      await this.token(),
      variables,
    )
    return result.assetUrlCreate
  }

  async updateExtension(_input: ExtensionUpdateDraftInput): Promise<ExtensionUpdateSchema> {
    throw new BugError('Not implemented: updateExtension')
  }

  async deploy({apiKey, appModules, organizationId, versionTag, bundleUrl}: AppDeployOptions): Promise<AppDeploySchema> {
    const variables: CreateAppVersionMutationVariables = {
      appId: apiKey,
      appModules: (appModules ?? []).map((mod) => {
        return {
          uid: mod.uuid ?? mod.handle,
          specificationIdentifier: mod.specificationIdentifier ?? underscore(mod.handle),
          handle: mod.handle,
          config: mod.config,
        }
      }),
      versionTag,
      assetsUrl: bundleUrl,
    }

    const result = await orgScopedShopifyDevelopersRequest<CreateAppVersionMutationSchema>(
      organizationId,
      CreateAppVersionMutation,
      await this.token(),
      variables,
    )
    console.log(JSON.stringify(result, null, 2))
    const {version, userErrors} = result.versionCreate
    if (!version) return {appDeploy: {userErrors}} as unknown as AppDeploySchema

    const devDashFqdn = (await shopifyDevelopersFqdn()).replace('app.', 'developers.')
    const versionResult = {
      appDeploy: {
        appVersion: {
          uuid: version.id,
          // Need to deal with ID properly as it's expected to be a number... how do we use it?
          id: parseInt(version.id, 10),
          versionTag: version.versionTag,
          location: `https://${devDashFqdn}/org/${organizationId}/apps/${apiKey}/versions/${version.id}`,
          appModuleVersions: version.modules.map((mod) => {
            return {
              uuid: mod.uid,
              registrationUuid: mod.uid,
              validationErrors: [],
            }
          }),
          message: '',
        },
        userErrors: userErrors?.map((err) => ({...err, category: 'deploy', details: []})),
      },
    }

    const releaseVariables: ReleaseVersionMutationVariables = {appId: apiKey, versionId: version.id}
    const releaseResult = await orgScopedShopifyDevelopersRequest<ReleaseVersionMutationSchema>(
      '1',
      ReleaseVersionMutation,
      await this.token(),
      releaseVariables,
    )
    if (releaseResult.versionRelease?.userErrors) {
      versionResult.appDeploy.userErrors = (versionResult.appDeploy.userErrors ?? []).concat(
        releaseResult.versionRelease.userErrors.map((err) => ({...err, category: 'release', details: []})),
      )
    }

    return versionResult
  }

  async release(_input: AppReleaseVariables): Promise<AppReleaseSchema> {
    throw new BugError('Not implemented: release')
  }

  async storeByDomain(_orgId: string, _shopDomain: string): Promise<FindStoreByDomainSchema> {
    throw new BugError('Not implemented: storeByDomain')
  }

  async createExtension(_input: ExtensionCreateVariables): Promise<ExtensionCreateSchema> {
    throw new BugError('Not implemented: createExtension')
  }

  async convertToTestStore(_input: ConvertDevToTestStoreVariables): Promise<ConvertDevToTestStoreSchema> {
    throw new BugError('Not implemented: convertToTestStore')
  }

  async updateDeveloperPreview(
    _input: DevelopmentStorePreviewUpdateInput,
  ): Promise<DevelopmentStorePreviewUpdateSchema> {
    throw new BugError('Not implemented: updateDeveloperPreview')
  }

  async appPreviewMode(_input: FindAppPreviewModeVariables): Promise<FindAppPreviewModeSchema> {
    throw new BugError('Not implemented: appPreviewMode')
  }

  async sendSampleWebhook(_input: SendSampleWebhookVariables): Promise<SendSampleWebhookSchema> {
    throw new BugError('Not implemented: sendSampleWebhook')
  }

  async apiVersions(): Promise<PublicApiVersionsSchema> {
    throw new BugError('Not implemented: apiVersions')
  }

  async topics(_input: WebhookTopicsVariables): Promise<WebhookTopicsSchema> {
    throw new BugError('Not implemented: topics')
  }

  async migrateFlowExtension(_input: MigrateFlowExtensionVariables): Promise<MigrateFlowExtensionSchema> {
    throw new BugError('Not implemented: migrateFlowExtension')
  }

  async migrateAppModule(_input: MigrateAppModuleVariables): Promise<MigrateAppModuleSchema> {
    throw new BugError('Not implemented: migrateAppModule')
  }

  async updateURLs(_input: UpdateURLsVariables): Promise<UpdateURLsSchema> {
    throw new BugError('Not implemented: updateURLs')
  }

  async currentAccountInfo(): Promise<CurrentAccountInfoSchema> {
    throw new BugError('Not implemented: currentAccountInfo')
  }

  async targetSchemaDefinition(_input: TargetSchemaDefinitionQueryVariables): Promise<string | null> {
    throw new BugError('Not implemented: targetSchemaDefinition')
  }

  async apiSchemaDefinition(_input: ApiSchemaDefinitionQueryVariables): Promise<string | null> {
    throw new BugError('Not implemented: apiSchemaDefinition')
  }

  async migrateToUiExtension(_input: MigrateToUiExtensionVariables): Promise<MigrateToUiExtensionSchema> {
    throw new BugError('Not implemented: migrateToUiExtension')
  }

  toExtensionGraphQLType(input: string) {
    return input.toLowerCase()
  }

  private async fetchApp({id, organizationId}: MinimalAppIdentifiers): Promise<ActiveAppReleaseQuerySchema> {
    const query = ActiveAppReleaseQuery
    const variables: ActiveAppReleaseQueryVariables = {appId: id}
    return orgScopedShopifyDevelopersRequest<ActiveAppReleaseQuerySchema>(
      organizationId,
      query,
      await this.token(),
      variables,
    )
  }
}

// this is a temporary solution for editions to support https://vault.shopify.io/gsd/projects/31406
// read more here: https://vault.shopify.io/gsd/projects/31406
const MAGIC_URL = 'https://shopify.dev/apps/default-app-home'
const MAGIC_REDIRECT_URL = 'https://shopify.dev/apps/default-app-home/api/auth'

function createAppVars(name: string, isLaunchable = true, scopesArray?: string[]): CreateAppMutationVariables {
  return {
    appModules: [
      {
        uid: 'app_home',
        specificationIdentifier: 'app_home',
        config: JSON.stringify({
          app_url: isLaunchable ? 'https://example.com' : MAGIC_URL,
          embedded: isLaunchable,
        }),
      },
      {
        uid: 'branding',
        specificationIdentifier: 'branding',
        config: JSON.stringify({name}),
      },
      {
        uid: 'webhooks',
        specificationIdentifier: 'webhooks',
        config: JSON.stringify({api_version: '2024-01'}),
      },
      {
        uid: 'app_access',
        specificationIdentifier: 'app_access',
        config: JSON.stringify({
          redirect_url_allowlist: isLaunchable ? ['https://example.com/api/auth'] : [MAGIC_REDIRECT_URL],
          ...(scopesArray && {scopes: scopesArray.map((scope) => scope.trim()).join(',')}),
        }),
      },
    ],
  }
}

async function stubbedExtensionTemplates(): Promise<ExtensionTemplate[]> {
  return [
    {
      identifier: 'order_discounts',
      name: 'Discount orders - Function',
      defaultName: 'order-discount',
      group: 'Discounts and checkout',
      sortPriority: undefined,
      supportLinks: ['https://shopify.dev/docs/apps/discounts'],
      types: [
        {
          url: 'https://github.com/Shopify/function-examples',
          type: 'function',
          extensionPoints: [],
          supportedFlavors: [
            {
              name: 'JavaScript',
              value: 'vanilla-js',
              path: 'discounts/javascript/order-discounts/default',
            },
            {
              name: 'TypeScript',
              value: 'typescript',
              path: 'discounts/javascript/order-discounts/default',
            },
            {
              name: 'Rust',
              value: 'rust',
              path: 'discounts/rust/order-discounts/default',
            },
            {
              name: 'Wasm',
              value: 'wasm',
              path: 'discounts/wasm/order-discounts/default',
            },
          ],
        },
      ],
    },
    {
      identifier: 'cart_checkout_validation',
      name: 'Cart and checkout validation - Function',
      defaultName: 'cart-checkout-validation',
      group: 'Discounts and checkout',
      sortPriority: undefined,
      supportLinks: ['https://shopify.dev/docs/api/functions/reference/cart-checkout-validation'],
      types: [
        {
          url: 'https://github.com/Shopify/function-examples',
          type: 'function',
          extensionPoints: [],
          supportedFlavors: [
            {
              name: 'JavaScript',
              value: 'vanilla-js',
              path: 'checkout/javascript/cart-checkout-validation/default',
            },
            {
              name: 'TypeScript',
              value: 'typescript',
              path: 'checkout/javascript/cart-checkout-validation/default',
            },
            {
              name: 'Rust',
              value: 'rust',
              path: 'checkout/rust/cart-checkout-validation/default',
            },
            {
              name: 'Wasm',
              value: 'wasm',
              path: 'checkout/wasm/cart-checkout-validation/default',
            },
          ],
        },
      ],
    },
    {
      identifier: 'cart_transform',
      name: 'Cart transformer - Function',
      defaultName: 'cart-transformer',
      group: 'Discounts and checkout',
      sortPriority: undefined,
      supportLinks: [],
      types: [
        {
          url: 'https://github.com/Shopify/function-examples',
          type: 'function',
          extensionPoints: [],
          supportedFlavors: [
            {
              name: 'JavaScript',
              value: 'vanilla-js',
              path: 'checkout/javascript/cart-transform/default',
            },
            {
              name: 'TypeScript',
              value: 'typescript',
              path: 'checkout/javascript/cart-transform/default',
            },
            {
              name: 'Rust',
              value: 'rust',
              path: 'checkout/rust/cart-transform/default',
            },
            {
              name: 'Wasm',
              value: 'wasm',
              path: 'checkout/wasm/cart-transform/default',
            },
          ],
        },
      ],
    },
    {
      identifier: 'delivery_customization',
      name: 'Delivery customization - Function',
      defaultName: 'delivery-customization',
      group: 'Discounts and checkout',
      sortPriority: undefined,
      supportLinks: [],
      types: [
        {
          url: 'https://github.com/Shopify/function-examples',
          type: 'function',
          extensionPoints: [],
          supportedFlavors: [
            {
              name: 'JavaScript',
              value: 'vanilla-js',
              path: 'checkout/javascript/delivery-customization/default',
            },
            {
              name: 'TypeScript',
              value: 'typescript',
              path: 'checkout/javascript/delivery-customization/default',
            },
            {
              name: 'Rust',
              value: 'rust',
              path: 'checkout/rust/delivery-customization/default',
            },
            {
              name: 'Wasm',
              value: 'wasm',
              path: 'checkout/wasm/delivery-customization/default',
            },
          ],
        },
      ],
    },
    {
      identifier: 'payment_customization',
      name: 'Payment customization - Function',
      defaultName: 'payment-customization',
      group: 'Discounts and checkout',
      sortPriority: undefined,
      supportLinks: [],
      types: [
        {
          url: 'https://github.com/Shopify/function-examples',
          type: 'function',
          extensionPoints: [],
          supportedFlavors: [
            {
              name: 'JavaScript',
              value: 'vanilla-js',
              path: 'checkout/javascript/payment-customization/default',
            },
            {
              name: 'TypeScript',
              value: 'typescript',
              path: 'checkout/javascript/payment-customization/default',
            },
            {
              name: 'Rust',
              value: 'rust',
              path: 'checkout/rust/payment-customization/default',
            },
            {
              name: 'Wasm',
              value: 'wasm',
              path: 'checkout/wasm/payment-customization/default',
            },
          ],
        },
      ],
    },
    {
      identifier: 'product_discounts',
      name: 'Discount products - Function',
      defaultName: 'product-discount',
      group: 'Discounts and checkout',
      sortPriority: undefined,
      supportLinks: ['https://shopify.dev/docs/apps/discounts'],
      types: [
        {
          url: 'https://github.com/Shopify/function-examples',
          type: 'function',
          extensionPoints: [],
          supportedFlavors: [
            {
              name: 'JavaScript',
              value: 'vanilla-js',
              path: 'discounts/javascript/product-discounts/default',
            },
            {
              name: 'TypeScript',
              value: 'typescript',
              path: 'discounts/javascript/product-discounts/default',
            },
            {
              name: 'Rust',
              value: 'rust',
              path: 'discounts/rust/product-discounts/default',
            },
            {
              name: 'Wasm',
              value: 'wasm',
              path: 'discounts/wasm/product-discounts/default',
            },
          ],
        },
      ],
    },
    {
      identifier: 'shipping_discounts',
      name: 'Discount shipping - Function',
      defaultName: 'shipping-discount',
      group: 'Discounts and checkout',
      sortPriority: undefined,
      supportLinks: ['https://shopify.dev/docs/apps/discounts'],
      types: [
        {
          url: 'https://github.com/Shopify/function-examples',
          type: 'function',
          extensionPoints: [],
          supportedFlavors: [
            {
              name: 'JavaScript',
              value: 'vanilla-js',
              path: 'discounts/javascript/shipping-discounts/default',
            },
            {
              name: 'TypeScript',
              value: 'typescript',
              path: 'discounts/javascript/shipping-discounts/default',
            },
            {
              name: 'Rust',
              value: 'rust',
              path: 'discounts/rust/shipping-discounts/default',
            },
            {
              name: 'Wasm',
              value: 'wasm',
              path: 'discounts/wasm/shipping-discounts/default',
            },
          ],
        },
      ],
    },
    {
      identifier: 'fulfillment_constraints',
      name: 'Fulfillment constraints - Function',
      defaultName: 'fulfillment-constraints',
      group: 'Discounts and checkout',
      sortPriority: undefined,
      supportLinks: [],
      types: [
        {
          url: 'https://github.com/Shopify/function-examples',
          type: 'function',
          extensionPoints: [],
          supportedFlavors: [
            {
              name: 'JavaScript',
              value: 'vanilla-js',
              path: 'order-routing/javascript/fulfillment-constraints/default',
            },
            {
              name: 'TypeScript',
              value: 'typescript',
              path: 'order-routing/javascript/fulfillment-constraints/default',
            },
            {
              name: 'Rust',
              value: 'rust',
              path: 'order-routing/rust/fulfillment-constraints/default',
            },
            {
              name: 'Wasm',
              value: 'wasm',
              path: 'order-routing/wasm/fulfillment-constraints/default',
            },
          ],
        },
      ],
    },
    {
      identifier: 'local_pickup_delivery_option_generator',
      name: 'Local pickup delivery option generators — Function',
      defaultName: 'local-pickup-delivery-option-generators',
      group: 'Discounts and checkout',
      sortPriority: undefined,
      supportLinks: [],
      types: [
        {
          url: 'https://github.com/Shopify/function-examples',
          type: 'function',
          extensionPoints: [],
          supportedFlavors: [
            {
              name: 'JavaScript',
              value: 'vanilla-js',
              path: 'order-routing/javascript/local-pickup-delivery-option-generators/default',
            },
            {
              name: 'TypeScript',
              value: 'typescript',
              path: 'order-routing/javascript/local-pickup-delivery-option-generators/default',
            },
            {
              name: 'Rust',
              value: 'rust',
              path: 'order-routing/rust/local-pickup-delivery-option-generators/default',
            },
            {
              name: 'Wasm',
              value: 'wasm',
              path: 'order-routing/wasm/local-pickup-delivery-option-generators/default',
            },
          ],
        },
      ],
    },
    {
      identifier: 'discounts_allocator',
      name: 'Discounts allocator — Function',
      defaultName: 'discounts-allocator',
      group: 'Discounts and checkout',
      sortPriority: undefined,
      supportLinks: ['https://shopify.dev/docs/apps/discounts'],
      types: [
        {
          url: 'https://github.com/Shopify/function-examples',
          type: 'function',
          extensionPoints: [],
          supportedFlavors: [
            {
              name: 'JavaScript',
              value: 'vanilla-js',
              path: 'discounts/javascript/discounts-allocator/default',
            },
            {
              name: 'TypeScript',
              value: 'typescript',
              path: 'discounts/javascript/discounts-allocator/default',
            },
            {
              name: 'Rust',
              value: 'rust',
              path: 'discounts/rust/discounts-allocator/default',
            },
            {
              name: 'Wasm',
              value: 'wasm',
              path: 'discounts/wasm/discounts-allocator/default',
            },
          ],
        },
      ],
    },
    {
      identifier: 'pickup_point_delivery_option_generator',
      name: 'Pickup point delivery option generators — Function',
      defaultName: 'pickup-point-delivery-option-generators',
      group: 'Discounts and checkout',
      sortPriority: undefined,
      supportLinks: [],
      types: [
        {
          url: 'https://github.com/Shopify/function-examples',
          type: 'function',
          extensionPoints: [],
          supportedFlavors: [
            {
              name: 'JavaScript',
              value: 'vanilla-js',
              path: 'order-routing/javascript/pickup-point-delivery-option-generators/default',
            },
            {
              name: 'TypeScript',
              value: 'typescript',
              path: 'order-routing/typescript/pickup-point-delivery-option-generators/default',
            },
            {
              name: 'Rust',
              value: 'rust',
              path: 'order-routing/rust/pickup-point-delivery-option-generators/default',
            },
            {
              name: 'Wasm',
              value: 'wasm',
              path: 'order-routing/wasm/pickup-point-delivery-option-generators/default',
            },
          ],
        },
      ],
    },
    {
      identifier: 'admin_action',
      name: 'Admin action',
      defaultName: 'admin-action',
      group: 'Admin',
      sortPriority: undefined,
      supportLinks: [],
      types: [
        {
          url: 'https://github.com/Shopify/extensions-templates',
          type: 'ui_extension',
          extensionPoints: [],
          supportedFlavors: [
            {
              name: 'JavaScript React',
              value: 'react',
              path: 'admin-action',
            },
            {
              name: 'JavaScript',
              value: 'vanilla-js',
              path: 'admin-action',
            },
            {
              name: 'TypeScript React',
              value: 'typescript-react',
              path: 'admin-action',
            },
            {
              name: 'TypeScript',
              value: 'typescript',
              path: 'admin-action',
            },
          ],
        },
      ],
    },
    {
      identifier: 'admin_block',
      name: 'Admin block',
      defaultName: 'admin-block',
      group: 'Admin',
      sortPriority: undefined,
      supportLinks: [],
      types: [
        {
          url: 'https://github.com/Shopify/extensions-templates',
          type: 'ui_extension',
          extensionPoints: [],
          supportedFlavors: [
            {
              name: 'JavaScript React',
              value: 'react',
              path: 'admin-block',
            },
            {
              name: 'JavaScript',
              value: 'vanilla-js',
              path: 'admin-block',
            },
            {
              name: 'TypeScript React',
              value: 'typescript-react',
              path: 'admin-block',
            },
            {
              name: 'TypeScript',
              value: 'typescript',
              path: 'admin-block',
            },
          ],
        },
      ],
    },
    {
      identifier: 'checkout_ui',
      name: 'Checkout UI',
      defaultName: 'checkout-ui',
      group: 'Discounts and checkout',
      sortPriority: 0,
      supportLinks: ['https://shopify.dev/api/checkout-extensions/checkout/configuration'],
      types: [
        {
          url: 'https://github.com/Shopify/extensions-templates',
          type: 'ui_extension',
          extensionPoints: [],
          supportedFlavors: [
            {
              name: 'JavaScript React',
              value: 'react',
              path: 'checkout-extension',
            },
            {
              name: 'JavaScript',
              value: 'vanilla-js',
              path: 'checkout-extension',
            },
            {
              name: 'TypeScript React',
              value: 'typescript-react',
              path: 'checkout-extension',
            },
            {
              name: 'TypeScript',
              value: 'typescript',
              path: 'checkout-extension',
            },
          ],
        },
      ],
    },
    {
      identifier: 'product_configuration',
      name: 'Product configuration',
      defaultName: 'product-configuration',
      group: 'Admin',
      sortPriority: undefined,
      supportLinks: ['https://shopify.dev/docs/apps/selling-strategies/bundles/product-config'],
      types: [
        {
          url: 'https://github.com/Shopify/extensions-templates',
          type: 'ui_extension',
          extensionPoints: [],
          supportedFlavors: [
            {
              name: 'JavaScript React',
              value: 'react',
              path: 'product-configuration-extension',
            },
            {
              name: 'JavaScript',
              value: 'vanilla-js',
              path: 'product-configuration-extension',
            },
            {
              name: 'TypeScript React',
              value: 'typescript-react',
              path: 'product-configuration-extension',
            },
            {
              name: 'TypeScript',
              value: 'typescript',
              path: 'product-configuration-extension',
            },
          ],
        },
      ],
    },
    {
      identifier: 'customer_account_ui',
      name: 'Customer account UI (preview for dev stores only)',
      defaultName: 'customer-account-ui',
      group: 'Customer account',
      sortPriority: undefined,
      supportLinks: [],
      types: [
        {
          url: 'https://github.com/Shopify/extensions-templates',
          type: 'ui_extension',
          extensionPoints: [],
          supportedFlavors: [
            {
              name: 'JavaScript React',
              value: 'react',
              path: 'customer-account-extension',
            },
            {
              name: 'JavaScript',
              value: 'vanilla-js',
              path: 'customer-account-extension',
            },
            {
              name: 'TypeScript React',
              value: 'typescript-react',
              path: 'customer-account-extension',
            },
            {
              name: 'TypeScript',
              value: 'typescript',
              path: 'customer-account-extension',
            },
          ],
        },
      ],
    },
    {
      identifier: 'pos_ui',
      name: 'POS UI',
      defaultName: 'pos-ui',
      group: 'Point-of-Sale',
      sortPriority: undefined,
      supportLinks: [],
      types: [
        {
          url: 'https://github.com/Shopify/extensions-templates',
          type: 'pos_ui_extension',
          extensionPoints: [],
          supportedFlavors: [
            {
              name: 'JavaScript React',
              value: 'react',
              path: 'pos-ui-extension',
            },
            {
              name: 'JavaScript',
              value: 'vanilla-js',
              path: 'pos-ui-extension',
            },
            {
              name: 'TypeScript React',
              value: 'typescript-react',
              path: 'pos-ui-extension',
            },
            {
              name: 'TypeScript',
              value: 'typescript',
              path: 'pos-ui-extension',
            },
          ],
        },
      ],
    },
    {
      identifier: 'tax_calculation',
      name: 'Tax calculation',
      defaultName: 'tax-calculation',
      group: 'Admin',
      sortPriority: undefined,
      supportLinks: [],
      types: [
        {
          url: 'https://github.com/Shopify/extensions-templates',
          type: 'tax_calculation',
          extensionPoints: [],
          supportedFlavors: [
            {
              name: 'Config only',
              value: 'config-only',
              path: 'tax-calculation',
            },
          ],
        },
      ],
    },
    {
      identifier: 'flow_action',
      name: 'Flow action',
      defaultName: 'Flow action',
      group: 'Automations',
      sortPriority: undefined,
      supportLinks: [],
      types: [
        {
          url: 'https://github.com/Shopify/extensions-templates',
          type: 'flow_action',
          extensionPoints: [],
          supportedFlavors: [
            {
              name: 'Config only',
              value: 'config-only',
              path: 'flow-action',
            },
          ],
        },
      ],
    },
    {
      identifier: 'flow_trigger',
      name: 'Flow trigger',
      defaultName: 'Flow trigger',
      group: 'Automations',
      sortPriority: undefined,
      supportLinks: [],
      types: [
        {
          url: 'https://github.com/Shopify/extensions-templates',
          type: 'flow_trigger',
          extensionPoints: [],
          supportedFlavors: [
            {
              name: 'Config only',
              value: 'config-only',
              path: 'flow-trigger',
            },
          ],
        },
      ],
    },
    {
      identifier: 'post_purchase_ui',
      name: 'Post-purchase UI',
      defaultName: 'post-purchase-ui',
      group: 'Discounts and checkout',
      sortPriority: 1,
      supportLinks: ['https://shopify.dev/docs/apps/checkout/post-purchase'],
      types: [
        {
          url: 'https://github.com/Shopify/extensions-templates',
          type: 'checkout_post_purchase',
          extensionPoints: [],
          supportedFlavors: [
            {
              name: 'JavaScript React',
              value: 'react',
              path: 'checkout-post-purchase',
            },
            {
              name: 'JavaScript',
              value: 'vanilla-js',
              path: 'checkout-post-purchase',
            },
            {
              name: 'TypeScript React',
              value: 'typescript-react',
              path: 'checkout-post-purchase',
            },
            {
              name: 'TypeScript',
              value: 'typescript',
              path: 'checkout-post-purchase',
            },
          ],
        },
      ],
    },
    {
      identifier: 'validation_settings_ui',
      name: 'Validation Settings - UI Extension',
      defaultName: 'validation-settings-ui',
      group: 'Admin',
      sortPriority: undefined,
      supportLinks: ['https://shopify.dev/docs/apps/checkout/validation/server-side'],
      types: [
        {
          url: 'https://github.com/Shopify/extensions-templates',
          type: 'ui_extension',
          extensionPoints: [],
          supportedFlavors: [
            {
              name: 'JavaScript React',
              value: 'react',
              path: 'validation-settings',
            },
            {
              name: 'JavaScript',
              value: 'vanilla-js',
              path: 'validation-settings',
            },
            {
              name: 'TypeScript React',
              value: 'typescript-react',
              path: 'validation-settings',
            },
            {
              name: 'TypeScript',
              value: 'typescript',
              path: 'validation-settings',
            },
          ],
        },
      ],
    },
    {
      identifier: 'flow_template',
      name: 'Flow template',
      defaultName: 'Flow template',
      group: 'Automations',
      sortPriority: undefined,
      supportLinks: [],
      types: [
        {
          url: 'https://github.com/Shopify/extensions-templates',
          type: 'flow_template',
          extensionPoints: [],
          supportedFlavors: [
            {
              name: 'Config only',
              value: 'config-only',
              path: 'flow-template',
            },
          ],
        },
      ],
    },
  ]
}

// Business platform uses base64-encoded GIDs, while Shopify Developers uses
// just the integer portion of that ID. These functions convert between the two.

// 1234 => gid://organization/Organization/1234 => base64
function encodedGidFromId(id: string): string {
  const gid = `gid://organization/Organization/${id}`
  return Buffer.from(gid).toString('base64')
}

// base64 => gid://organization/Organization/1234 => 1234
function idFromEncodedGid(gid: string): string {
  return Buffer.from(gid, 'base64').toString('ascii').match(/\d+$/)![0]
}
