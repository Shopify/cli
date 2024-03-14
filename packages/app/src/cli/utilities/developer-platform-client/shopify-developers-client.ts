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
// import {SpecificationsQuery, SpecificationsQueryVariables, SpecificationsQuerySchema} from './shopify-developers-client/graphql/specifications.js'
import {RemoteSpecification} from '../../api/graphql/extension_specifications.js'
import {DeveloperPlatformClient, Paginateable, ActiveAppVersion} from '../developer-platform-client.js'
import {PartnersSession} from '../../../cli/services/context/partner-account-info.js'
import {filterDisabledBetas} from '../../../cli/services/dev/fetch.js'
import {MinimalOrganizationApp, Organization, OrganizationApp, OrganizationStore} from '../../models/organization.js'
import {AllAppExtensionRegistrationsQuerySchema} from '../../api/graphql/all_app_extension_registrations.js'
import {
  GenerateSignedUploadUrlSchema,
  GenerateSignedUploadUrlVariables,
} from '../../api/graphql/generate_signed_upload_url.js'
import {ExtensionUpdateDraftInput, ExtensionUpdateSchema} from '../../api/graphql/update_draft.js'
import {AppDeploySchema, AppDeployVariables} from '../../api/graphql/app_deploy.js'
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
import {FunctionUploadUrlGenerateResponse} from '@shopify/cli-kit/node/api/partners'
import {isUnitTest} from '@shopify/cli-kit/node/context/local'
import {AbortError, BugError} from '@shopify/cli-kit/node/error'
import {orgScopedShopifyDevelopersRequest} from '@shopify/cli-kit/node/api/shopify-developers'
import {CreateAppVersionMutation, CreateAppVersionMutationSchema, CreateAppVersionMutationVariables} from './shopify-developers-client/graphql/create-app-version.js'
import {underscore} from '@shopify/cli-kit/common/string'
import {ReleaseVersionMutation, ReleaseVersionMutationSchema, ReleaseVersionMutationVariables} from './shopify-developers-client/graphql/release-version.js'

const ORG1 = {
  id: '1',
  businessName: 'Test Org',
}

export class ShopifyDevelopersClient implements DeveloperPlatformClient {
  private _session: PartnersSession | undefined
  public supportsAtomicDeployments = true

  constructor(session?: PartnersSession) {
    this._session = session
  }

  async session(): Promise<PartnersSession> {
    if (!this._session) {
      if (isUnitTest()) {
        throw new Error('ShopifyDevelopersClient.session() should not be invoked dynamically in a unit test')
      }
      // Need to replace with actual auth
      this._session = {
        token: 'token',
        accountInfo: {
          type: 'UserAccount',
          email: 'mail@example.com',
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

  async accountInfo(): Promise<PartnersSession['accountInfo']> {
    return (await this.session()).accountInfo
  }

  async appFromId(appIdentifiers: MinimalOrganizationApp): Promise<OrganizationApp | undefined> {
    const {app} = await this.fetchApp(appIdentifiers)
    const {modules} = app.activeRelease.version
    const brandingModule = modules.find((mod) => mod.specification.identifier === 'branding')!
    const appAccessModule = modules.find((mod) => mod.specification.identifier === 'app_access')!
    return {
      id: app.id,
      title: brandingModule.config.name as string,
      apiKey: app.id,
      organizationId: appIdentifiers.organizationId,
      apiSecretKeys: [],
      grantedScopes: appAccessModule.config.scopes as string[],
      betas: [],
    }
  }

  private async fetchApp({id, organizationId}: MinimalOrganizationApp): Promise<ActiveAppReleaseQuerySchema> {
    const query = ActiveAppReleaseQuery
    const variables: ActiveAppReleaseQueryVariables = {appId: id}
    return orgScopedShopifyDevelopersRequest<ActiveAppReleaseQuerySchema>(
      organizationId,
      query,
      await this.token(),
      variables,
    )
  }

  async organizations(): Promise<Organization[]> {
    return [ORG1]
  }

  async orgFromId(orgId: string): Promise<Organization | undefined> {
    if (orgId === '1') return ORG1

    throw new BugError(`Can't fetch organization with id ${orgId}`)
  }

  async orgAndApps(orgId: string): Promise<Paginateable<{organization: Organization; apps: MinimalOrganizationApp[]}>> {
    if (orgId === '1') {
      return {
        organization: ORG1,
        apps: [],
        hasMorePages: false,
      }
    } else {
      throw new BugError(`Can't fetch organization with id ${orgId}`)
    }
  }

  async appsForOrg(_organizationId: string, _term?: string): Promise<Paginateable<{apps: MinimalOrganizationApp[]}>> {
    return {
      apps: [],
      hasMorePages: false,
    }
  }

  async specifications(_appId: string): Promise<RemoteSpecification[]> {
    return stubbedExtensionSpecifications()

    // // This should be the actual query, but it's not working at the moment...
    // const query = SpecificationsQuery
    // const variables: SpecificationsQueryVariables = {appId}
    // const result = await orgScopedShopifyDevelopersRequest<SpecificationsQuerySchema>(ORG1.id, query, await this.token(), variables)
    // console.log(JSON.stringify(result, null, 2))
    // return result.specifications.map((spec): ExtensionSpecification => ({
    // externalName: spec.name,
    // additionalIdentifiers: [],
    // partnersWebIdentifier: spec.identifier,
    // surface: '',
    // registrationLimit: 1,
    // appModuleFeatures: (_config) => [],
    // ...spec,
    // experience: spec.experience.toLowerCase() as 'extension' | 'configuration',
    // }))
  }

  async templateSpecifications(_appId: string): Promise<ExtensionTemplate[]> {
    throw new BugError('Not implemented: templateSpecifications')
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
    const betas = filterDisabledBetas([])
    const createdApp = result.appCreate.app
    return {
      ...createdApp,
      title: name,
      apiKey: createdApp.id,
      apiSecretKeys: [],
      grantedScopes: options?.scopesArray ?? [],
      organizationId: org.id,
      newApp: true,
      betas,
    }
  }

  async devStoresForOrg(_orgId: string): Promise<OrganizationStore[]> {
    return []
  }

  async appExtensionRegistrations(appIdentifiers: MinimalOrganizationApp): Promise<AllAppExtensionRegistrationsQuerySchema> {
    const {app} = await this.fetchApp(appIdentifiers)
    const {modules} = app.activeRelease.version
    return {
      app: {
        extensionRegistrations: [],
        dashboardManagedExtensionRegistrations: [],
        configurationRegistrations: modules.filter((mod) => mod.specification.experience === 'CONFIGURATION').map((mod) => ({
          id: mod.uid,
          uuid: mod.uid,
          title: mod.specification.name,
          type: mod.specification.identifier,
        })),
      }
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

  async activeAppVersion({id, organizationId}: MinimalOrganizationApp): Promise<ActiveAppVersion> {
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
          type: mod.specification.identifier,
          config: mod.config,
          specification: {
            ...mod.specification,
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

  async generateSignedUploadUrl(_input: GenerateSignedUploadUrlVariables): Promise<GenerateSignedUploadUrlSchema> {
    throw new BugError('Not implemented: generateSignedUploadUrl')
  }

  async updateExtension(_input: ExtensionUpdateDraftInput): Promise<ExtensionUpdateSchema> {
    throw new BugError('Not implemented: updateExtension')
  }

  async deploy({apiKey, appModules, versionTag}: AppDeployVariables): Promise<AppDeploySchema> {
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
    }

    const result = await orgScopedShopifyDevelopersRequest<CreateAppVersionMutationSchema>('1', CreateAppVersionMutation, await this.token(), variables)
    const {version, userErrors} = result.versionCreate
    if (!version) return {appDeploy: {userErrors}} as any as AppDeploySchema

    const versionResult = {
      appDeploy: {
        appVersion: {
          uuid: version.id,
          // Need to deal with ID properly as it's expected to be a number... how do we use it?
          id: parseInt(version.id, 10),
          versionTag: version.versionTag,
          location: 'location',
          appModuleVersions: version.modules.map((mod) => {
            return {
              uuid: mod.uid,
              registrationUuid: mod.uid,
              validationErrors: [],
            }
          }),
          message: 'Success!'
        },
        userErrors: userErrors?.map(err => ({...err, category: 'deploy', details: []})),
      }
    }

    const releaseVariables: ReleaseVersionMutationVariables = {appId: apiKey, versionId: version.id}
    const releaseResult = await orgScopedShopifyDevelopersRequest<ReleaseVersionMutationSchema>('1', ReleaseVersionMutation, await this.token(), releaseVariables)
    if (releaseResult.versionRelease?.userErrors) {
      versionResult.appDeploy.userErrors = (versionResult.appDeploy.userErrors ?? []).concat(
        releaseResult.versionRelease.userErrors.map(err => ({...err, category: 'release', details: []}))
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

  async updateURLs(_input: UpdateURLsVariables): Promise<UpdateURLsSchema> {
    throw new BugError('Not implemented: updateURLs')
  }

  async currentAccountInfo(): Promise<CurrentAccountInfoSchema> {
    throw new BugError('Not implemented: currentAccountInfo')
  }

  async targetSchemaDefinition(_input: TargetSchemaDefinitionQueryVariables): Promise<string | null> {
    throw new BugError('Not implemented: targetSchemaDefinition')
  }

  async apiSchemaDefinition(input: ApiSchemaDefinitionQueryVariables): Promise<string | null> {
    throw new BugError('Not implemented: apiSchemaDefinition')
  }

  async migrateToUiExtension(input: MigrateToUiExtensionVariables): Promise<MigrateToUiExtensionSchema> {
    throw new BugError('Not implemented: migrateToUiExtension')
  }

  toExtensionGraphQLType(input: string) {
    return input.toLowerCase()
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

async function stubbedExtensionSpecifications(): Promise<RemoteSpecification[]> {
  return [
    {
      name: 'App access',
      externalName: 'App access',
      externalIdentifier: 'app_access',
      identifier: 'app_access',
      gated: false,
      experience: 'configuration',
      options: {
        managementExperience: 'cli',
        registrationLimit: 1,
      },
      features: {
        argo: undefined,
      },
    },
    {
      name: 'App Home',
      externalName: 'App Home',
      externalIdentifier: 'app_home',
      identifier: 'app_home',
      gated: false,
      experience: 'configuration',
      options: {
        managementExperience: 'cli',
        registrationLimit: 1,
      },
      features: {
        argo: undefined,
      },
    },
    {
      name: 'Branding',
      externalName: 'Branding',
      externalIdentifier: 'branding',
      identifier: 'branding',
      gated: false,
      experience: 'configuration',
      options: {
        managementExperience: 'cli',
        registrationLimit: 1,
      },
      features: {
        argo: undefined,
      },
    },
    {
      name: 'Webhooks',
      externalName: 'Webhooks',
      externalIdentifier: 'webhooks',
      identifier: 'webhooks',
      gated: false,
      experience: 'configuration',
      options: {
        managementExperience: 'cli',
        registrationLimit: 1,
      },
      features: {
        argo: undefined,
      },
    },
  ]
}
