import {
  CreateAppMutation,
  CreateAppMutationVariables,
  CreateAppMutationSchema,
} from './app-management-client/graphql/create-app.js'
import {
  ActiveAppReleaseQuery,
  ActiveAppReleaseQueryVariables,
  ActiveAppReleaseQuerySchema,
} from './app-management-client/graphql/active-app-release.js'
import {
  SpecificationsQuery,
  SpecificationsQueryVariables,
  SpecificationsQuerySchema,
} from './app-management-client/graphql/specifications.js'
import {
  AppVersionsQuery,
  AppVersionsQueryVariables,
  AppVersionsQuerySchema,
} from './app-management-client/graphql/app-versions.js'
import {
  CreateAppVersionMutation,
  CreateAppVersionMutationSchema,
  CreateAppVersionMutationVariables,
} from './app-management-client/graphql/create-app-version.js'
import {
  ReleaseVersionMutation,
  ReleaseVersionMutationSchema,
  ReleaseVersionMutationVariables,
} from './app-management-client/graphql/release-version.js'
import {OrganizationsQuery, OrganizationsQuerySchema} from './app-management-client/graphql/organizations.js'
import {AppsQuery, AppsQuerySchema, MinimalAppModule} from './app-management-client/graphql/apps.js'
import {
  OrganizationQuery,
  OrganizationQuerySchema,
  OrganizationQueryVariables,
} from './app-management-client/graphql/organization.js'
import {UserInfoQuery, UserInfoQuerySchema} from './app-management-client/graphql/user-info.js'
import {CreateAssetURLMutation, CreateAssetURLMutationSchema} from './app-management-client/graphql/create-asset-url.js'
import {
  AppVersionByIdQuery,
  AppVersionByIdQuerySchema,
  AppVersionByIdQueryVariables,
  AppModule as AppModuleReturnType,
} from './app-management-client/graphql/app-version-by-id.js'
import {RemoteSpecification} from '../../api/graphql/extension_specifications.js'
import {
  DeveloperPlatformClient,
  Paginateable,
  ActiveAppVersion,
  AppDeployOptions,
  DevSessionDeployOptions,
  AssetUrlSchema,
  AppVersionIdentifiers,
} from '../developer-platform-client.js'
import {PartnersSession} from '../../services/context/partner-account-info.js'
import {
  MinimalAppIdentifiers,
  MinimalOrganizationApp,
  Organization,
  OrganizationApp,
  OrganizationSource,
  OrganizationStore,
} from '../../models/organization.js'
import {filterDisabledFlags} from '../../services/dev/fetch.js'
import {
  AllAppExtensionRegistrationsQuerySchema,
  ExtensionRegistration,
} from '../../api/graphql/all_app_extension_registrations.js'
import {ExtensionUpdateDraftInput, ExtensionUpdateSchema} from '../../api/graphql/update_draft.js'
import {AppDeploySchema} from '../../api/graphql/app_deploy.js'
import {FindStoreByDomainSchema} from '../../api/graphql/find_store_by_domain.js'
import {AppVersionsQuerySchema as AppVersionsQuerySchemaInterface} from '../../api/graphql/get_versions_list.js'
import {ExtensionCreateSchema, ExtensionCreateVariables} from '../../api/graphql/extension_create.js'
import {
  ConvertDevToTransferDisabledSchema,
  ConvertDevToTransferDisabledStoreVariables,
} from '../../api/graphql/convert_dev_to_transfer_disabled_store.js'
import {FindAppPreviewModeSchema, FindAppPreviewModeVariables} from '../../api/graphql/find_app_preview_mode.js'
import {
  DevelopmentStorePreviewUpdateInput,
  DevelopmentStorePreviewUpdateSchema,
} from '../../api/graphql/development_preview.js'
import {AppReleaseSchema} from '../../api/graphql/app_release.js'
import {AppVersionByTagSchema as AppVersionByTagSchemaInterface} from '../../api/graphql/app_version_by_tag.js'
import {AppVersionsDiffSchema} from '../../api/graphql/app_versions_diff.js'
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
import {
  DevSessionCreate,
  DevSessionCreateSchema,
  DevSessionCreateVariables,
} from '../../api/graphql/dev_session_create.js'
import {AppLogsSubscribeVariables, AppLogsSubscribeResponse} from '../../api/graphql/subscribe_to_app_logs.js'
import {AppHomeSpecIdentifier} from '../../models/extensions/specifications/app_config_app_home.js'
import {BrandingSpecIdentifier} from '../../models/extensions/specifications/app_config_branding.js'
import {WebhooksSpecIdentifier} from '../../models/extensions/specifications/app_config_webhook.js'
import {AppAccessSpecIdentifier} from '../../models/extensions/specifications/app_config_app_access.js'
import {CONFIG_EXTENSION_IDS} from '../../models/extensions/extension-instance.js'
import {ensureAuthenticatedAppManagement, ensureAuthenticatedBusinessPlatform} from '@shopify/cli-kit/node/session'
import {FunctionUploadUrlGenerateResponse} from '@shopify/cli-kit/node/api/partners'
import {isUnitTest} from '@shopify/cli-kit/node/context/local'
import {AbortError, BugError} from '@shopify/cli-kit/node/error'
import {fetch} from '@shopify/cli-kit/node/http'
import {appManagementRequest} from '@shopify/cli-kit/node/api/app-management'
import {devSessionRequest} from '@shopify/cli-kit/node/api/dev-session'
import {businessPlatformRequest} from '@shopify/cli-kit/node/api/business-platform'
import {appManagementFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {CLI_KIT_VERSION} from '@shopify/cli-kit/common/version'
import {versionSatisfies} from '@shopify/cli-kit/node/node-package-manager'

const TEMPLATE_JSON_URL = 'https://raw.githubusercontent.com/Shopify/extensions-templates/main/templates.json'

export interface GatedExtensionTemplate extends ExtensionTemplate {
  organizationBetaFlags?: string[]
  minimumCliVersion?: string
}

export class AppManagementClient implements DeveloperPlatformClient {
  public clientName = 'app-management'
  public requiresOrganization = true
  public supportsAtomicDeployments = true
  private _session: PartnersSession | undefined
  private _businessPlatformToken: string | undefined

  constructor(session?: PartnersSession) {
    this._session = session
  }

  async subscribeToAppLogs(input: AppLogsSubscribeVariables): Promise<AppLogsSubscribeResponse> {
    throw new Error(`Not Implemented: ${input}`)
  }

  async session(): Promise<PartnersSession> {
    if (!this._session) {
      if (isUnitTest()) {
        throw new Error('AppManagementClient.session() should not be invoked dynamically in a unit test')
      }
      const userInfoResult = await businessPlatformRequest<UserInfoQuerySchema>(
        UserInfoQuery,
        await this.businessPlatformToken(),
      )
      const token = await ensureAuthenticatedAppManagement()
      if (userInfoResult.currentUserAccount) {
        this._session = {
          token,
          accountInfo: {
            type: 'UserAccount',
            email: userInfoResult.currentUserAccount.email,
          },
        }
      } else {
        this._session = {
          token,
          accountInfo: {
            type: 'UnknownAccount',
          },
        }
      }
    }
    return this._session
  }

  async token(): Promise<string> {
    return (await this.session()).token
  }

  async refreshToken(): Promise<string> {
    const newToken = await ensureAuthenticatedAppManagement([], process.env, {noPrompt: true})
    const session = await this.session()
    if (newToken) {
      session.token = newToken
    }
    return session.token
  }

  async businessPlatformToken(): Promise<string> {
    if (isUnitTest()) {
      throw new Error('AppManagementClient.businessPlatformToken() should not be invoked dynamically in a unit test')
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
    return {
      id: 'gid://shopify/app/130918678529',
      title: 'title',
      apiKey: 'gid://shopify/app/130918678529',
      organizationId: '109300',
      apiSecretKeys: [],
      grantedScopes: [],
      flags: [],
      developerPlatformClient: this,
    }
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
      developerPlatformClient: this,
    }
  }

  async organizations(): Promise<Organization[]> {
    const organizationsResult = await businessPlatformRequest<OrganizationsQuerySchema>(
      OrganizationsQuery,
      await this.businessPlatformToken(),
    )
    if (!organizationsResult.currentUserAccount) return []
    return organizationsResult.currentUserAccount.organizations.nodes.map((org) => ({
      id: idFromEncodedGid(org.id),
      businessName: org.name,
      source: OrganizationSource.BusinessPlatform,
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
      source: OrganizationSource.BusinessPlatform,
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
    const result = await appManagementRequest<AppsQuerySchema>(organizationId, query, await this.token())
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
    // remove when the endpoint is available
    return stubbedExtensionSpecifications()

    const query = SpecificationsQuery
    const variables: SpecificationsQueryVariables = {appId}
    const result = await appManagementRequest<SpecificationsQuerySchema>(
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
          identifier: spec.identifier,
          externalIdentifier: spec.externalIdentifier,
          gated: false,
          options: {
            managementExperience: 'cli',
            registrationLimit: spec.appModuleLimit,
          },
          experience: CONFIG_EXTENSION_IDS.includes(spec.identifier) ? 'configuration' : 'extension',
        }),
      )
  }

  async templateSpecifications({organizationId}: MinimalAppIdentifiers): Promise<ExtensionTemplate[]> {
    let response
    let templates: GatedExtensionTemplate[]
    try {
      response = await fetch(TEMPLATE_JSON_URL)
      templates = await (response.json() as Promise<GatedExtensionTemplate[]>)
    } catch (_e) {
      throw new AbortError(
        [
          'Failed to fetch extension templates from',
          {link: {url: TEMPLATE_JSON_URL}},
          {char: '.'},
          'This likely means a problem with GitHub.',
        ],
        [
          {link: {url: 'https://www.githubstatus.com', label: 'Check if GitHub is experiencing downtime'}},
          'or try again later.',
        ],
      )
    }
    // Fake the sortPriority as ascending, since the templates are already sorted
    // in the static JSON file. This can be removed once PartnersClient, which
    // uses sortPriority, is gone.
    let counter = 0
    return (
      await allowedTemplates(templates, async (betaFlags: string[]) =>
        this.organizationBetaFlags(organizationId, betaFlags),
      )
    ).map((template) => ({...template, sortPriority: counter++}))
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
    const result = await appManagementRequest<CreateAppMutationSchema>(org.id, mutation, await this.token(), variables)
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
      developerPlatformClient: this,
    }
  }

  async devStoresForOrg(_orgId: string): Promise<OrganizationStore[]> {
    return []
  }

  async appExtensionRegistrations(
    appIdentifiers: MinimalAppIdentifiers,
  ): Promise<AllAppExtensionRegistrationsQuerySchema> {
    const {app} = await this.fetchApp(appIdentifiers)
    const configurationRegistrations: ExtensionRegistration[] = []
    const extensionRegistrations: ExtensionRegistration[] = []
    app.activeRelease.version.modules.forEach((mod) => {
      const registration = {
        id: mod.uid,
        uid: mod.uid,
        uuid: mod.uid,
        title: mod.specification.name,
        type: mod.specification.identifier,
      }
      if (mod.specification.experience === 'CONFIGURATION') configurationRegistrations.push(registration)
      if (mod.specification.experience === 'EXTENSION') extensionRegistrations.push(registration)
    })
    return {
      app: {
        dashboardManagedExtensionRegistrations: [],
        configurationRegistrations,
        extensionRegistrations,
      },
    }
  }

  async appVersions({id, organizationId, title}: OrganizationApp): Promise<AppVersionsQuerySchemaInterface> {
    const query = AppVersionsQuery
    const variables: AppVersionsQueryVariables = {appId: id}
    const result = await appManagementRequest<AppVersionsQuerySchema>(
      organizationId,
      query,
      await this.token(),
      variables,
    )
    return {
      app: {
        id: result.app.id,
        organizationId,
        title,
        appVersions: {
          nodes: result.app.versions.map((version) => {
            return {
              createdAt: '0',
              createdBy: {
                displayName: version.createdBy.name,
              },
              versionTag: version.versionTag,
              status: '',
              versionId: version.id,
            }
          }),
          pageInfo: {
            totalResults: result.app.versions.length,
          },
        },
      },
    }
  }

  async appVersionByTag(
    {id: appId, apiKey, organizationId}: MinimalOrganizationApp,
    tag: string,
  ): Promise<AppVersionByTagSchemaInterface> {
    const query = AppVersionsQuery
    const variables: AppVersionsQueryVariables = {appId}
    const result = await appManagementRequest<AppVersionsQuerySchema>(
      organizationId,
      query,
      await this.token(),
      variables,
    )
    if (!result.app) {
      throw new AbortError(`App not found for API key: ${apiKey}`)
    }
    const version = result.app.versions.find((version) => version.versionTag === tag)
    if (!version) {
      throw new AbortError(`Version not found for tag: ${tag}`)
    }

    const query2 = AppVersionByIdQuery
    const variables2: AppVersionByIdQueryVariables = {appId, versionId: version.id}
    const result2 = await appManagementRequest<AppVersionByIdQuerySchema>(
      organizationId,
      query2,
      await this.token(),
      variables2,
    )
    const versionInfo = result2.app.version

    return {
      app: {
        appVersion: {
          id: parseInt(versionInfo.id, 10),
          uuid: versionInfo.id,
          versionTag: versionInfo.versionTag,
          location: '',
          message: '',
          appModuleVersions: result2.app.version.modules.map((mod: AppModuleReturnType) => {
            return {
              registrationId: mod.key,
              registrationUid: mod.uid,
              registrationUuid: mod.uid,
              registrationTitle: mod.handle,
              type: mod.specification.externalIdentifier,
              config: JSON.stringify(mod.config),
              specification: {
                ...mod.specification,
                identifier: mod.specification.externalIdentifier,
                options: {managementExperience: 'cli'},
                experience: mod.specification.experience.toLowerCase() as 'configuration' | 'extension' | 'deprecated',
              },
            }
          }),
        },
      },
    }
  }

  async appVersionsDiff(
    app: MinimalOrganizationApp,
    {versionId}: AppVersionIdentifiers,
  ): Promise<AppVersionsDiffSchema> {
    const variables: AppVersionByIdQueryVariables = {appId: app.id, versionId}
    const [currentVersion, selectedVersion] = await Promise.all([
      this.activeAppVersionRawResult(app),
      appManagementRequest<AppVersionByIdQuerySchema>(
        app.organizationId,
        AppVersionByIdQuery,
        await this.token(),
        variables,
      ),
    ])
    const currentModules = currentVersion.app.activeRelease.version.modules
    const selectedVersionModules = selectedVersion.app.version.modules
    const {added, removed, updated} = diffAppModules({currentModules, selectedVersionModules})

    function formattedModule(mod: AppModuleReturnType) {
      return {
        uuid: mod.uid,
        registrationTitle: mod.handle,
        specification: {
          identifier: mod.specification.identifier,
          experience: mod.specification.experience.toLowerCase(),
          options: {
            managementExperience: mod.specification.experience.toLowerCase(),
          },
        },
      }
    }

    return {
      app: {
        versionsDiff: {
          added: added.map(formattedModule),
          updated: updated.map(formattedModule),
          removed: removed.map(formattedModule),
        },
      },
    }
  }

  async activeAppVersion(app: MinimalAppIdentifiers): Promise<ActiveAppVersion> {
    const result = await this.activeAppVersionRawResult(app)
    return {
      appModuleVersions: result.app.activeRelease.version.modules.map((mod) => {
        const experience = CONFIG_EXTENSION_IDS.includes(mod.uid) ? 'configuration' : 'extension'
        return {
          registrationId: mod.key,
          registrationUid: mod.uid,
          registrationUuid: mod.uid,
          registrationTitle: mod.handle,
          type: mod.specification.externalIdentifier,
          config: mod.config,
          specification: {
            ...mod.specification,
            identifier: mod.specification.identifier,
            options: {managementExperience: 'cli'},
            experience,
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
    const result = await appManagementRequest<CreateAssetURLMutationSchema>(
      organizationId,
      CreateAssetURLMutation,
      await this.token(),
    )

    return {
      assetUrl: result.appRequestSourceUploadUrl.sourceUploadUrl,
      userErrors: result.appRequestSourceUploadUrl.userErrors,
    }
  }

  async updateExtension(_input: ExtensionUpdateDraftInput): Promise<ExtensionUpdateSchema> {
    throw new BugError('Not implemented: updateExtension')
  }

  async deploy({
    apiKey,
    appModules,
    organizationId,
    versionTag,
    bundleUrl,
  }: AppDeployOptions): Promise<AppDeploySchema> {
    const variables: CreateAppVersionMutationVariables = {
      appId: apiKey,
      appSource: {
        assetsUrl: bundleUrl,
        modules: (appModules ?? []).map((mod) => {
          return {
            uid: mod.uid ?? mod.uuid ?? mod.handle,
            specificationIdentifier: mod.specificationIdentifier,
            handle: mod.handle,
            config: JSON.parse(mod.config),
          }
        }),
      },
      metadata: {
        versionTag,
      },
    }

    const result = await appManagementRequest<CreateAppVersionMutationSchema>(
      organizationId,
      CreateAppVersionMutation,
      await this.token(),
      variables,
    )
    const {version, userErrors} = result.appVersionCreate
    if (!version) return {appDeploy: {userErrors}} as unknown as AppDeploySchema

    const devDashFqdn = (await appManagementFqdn()).replace('app.', 'developers.')
    const versionResult = {
      appDeploy: {
        appVersion: {
          uuid: version.id,
          // Need to deal with ID properly as it's expected to be a number... how do we use it?
          id: parseInt(version.id, 10),
          versionTag: versionTag ?? 'VERSION TAG NOT RETURNED FROM API YET',
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
    const releaseResult = await appManagementRequest<ReleaseVersionMutationSchema>(
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

  async devSessionDeploy({appId, assetsUrl, shopName}: DevSessionDeployOptions): Promise<DevSessionCreateSchema> {
    const query = DevSessionCreate
    const variables: DevSessionCreateVariables = {appId: String(numberFromGid(appId)), assetsUrl}
    return devSessionRequest<DevSessionCreateSchema>(shopName, query, await this.token(), variables)
  }

  async release({
    app: {id: appId, organizationId},
    version: {versionId},
  }: {
    app: MinimalOrganizationApp
    version: AppVersionIdentifiers
  }): Promise<AppReleaseSchema> {
    const releaseVariables: ReleaseVersionMutationVariables = {appId, versionId}
    const releaseResult = await appManagementRequest<ReleaseVersionMutationSchema>(
      organizationId,
      ReleaseVersionMutation,
      await this.token(),
      releaseVariables,
    )
    return {
      appRelease: {
        appVersion: {
          versionTag: releaseResult.versionRelease.release.version.versionTag,
          message: '',
          location: '',
        },
        userErrors: releaseResult.versionRelease.userErrors?.map((err) => ({
          field: err.field,
          message: err.message,
          category: '',
          details: [],
        })),
      },
    }
  }

  async storeByDomain(_orgId: string, _shopDomain: string): Promise<FindStoreByDomainSchema> {
    throw new BugError('Not implemented: storeByDomain')
  }

  async createExtension(_input: ExtensionCreateVariables): Promise<ExtensionCreateSchema> {
    throw new BugError('Not implemented: createExtension')
  }

  async convertToTransferDisabledStore(
    _input: ConvertDevToTransferDisabledStoreVariables,
  ): Promise<ConvertDevToTransferDisabledSchema> {
    throw new BugError('Not implemented: convertToTransferDisabledStore')
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
    return {publicApiVersions: ['unstable']}
    // throw new BugError('Not implemented: apiVersions')
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
    const appId = numberFromGid(id)
    const variables: ActiveAppReleaseQueryVariables = {appId}
    return {
      app: {
        id: 'gid://shopify/app/130918678529',
        activeRelease: {
          id: 'gid://shopify/app/130918678529',
          version: {
            modules: [],
          },
        },
      },
    }
    return appManagementRequest<ActiveAppReleaseQuerySchema>(organizationId, query, await this.token(), variables)
  }

  private async activeAppVersionRawResult({
    id,
    organizationId,
  }: MinimalAppIdentifiers): Promise<ActiveAppReleaseQuerySchema> {
    const appId = numberFromGid(id)
    const variables: ActiveAppReleaseQueryVariables = {appId}
    return {
      app: {
        id: 'gid://shopify/app/130918678529',
        activeRelease: {
          id: 'gid://shopify/app/130918678529',
          version: {
            modules: [],
          },
        },
      },
    }
    return appManagementRequest<ActiveAppReleaseQuerySchema>(
      organizationId,
      ActiveAppReleaseQuery,
      await this.token(),
      variables,
    )
  }

  private async organizationBetaFlags(
    _organizationId: string,
    allBetaFlags: string[],
  ): Promise<{[key: string]: boolean}> {
    // For now, stub everything as false
    const stub: {[flag: string]: boolean} = {}
    allBetaFlags.forEach((flag) => {
      stub[flag] = false
    })
    return stub
  }
}

// this is a temporary solution for editions to support https://vault.shopify.io/gsd/projects/31406
// read more here: https://vault.shopify.io/gsd/projects/31406
const MAGIC_URL = 'https://shopify.dev/apps/default-app-home'
const MAGIC_REDIRECT_URL = 'https://shopify.dev/apps/default-app-home/api/auth'

function createAppVars(name: string, isLaunchable = true, scopesArray?: string[]): CreateAppMutationVariables {
  return {
    appSource: {
      modules: [
        {
          // Change the uid to AppHomeSpecIdentifier
          uid: 'app_home',
          specificationIdentifier: AppHomeSpecIdentifier,
          config: {
            app_url: isLaunchable ? 'https://example.com' : MAGIC_URL,
            embedded: isLaunchable,
          },
        },
        {
          // Change the uid to BrandingSpecIdentifier
          uid: 'branding',
          specificationIdentifier: BrandingSpecIdentifier,
          config: {name},
        },
        {
          // Change the uid to WebhooksSpecIdentifier
          uid: 'webhooks',
          specificationIdentifier: WebhooksSpecIdentifier,
          config: {api_version: '2024-01'},
        },
        {
          // Change the uid to AppAccessSpecIdentifier
          uid: 'app_access',
          specificationIdentifier: AppAccessSpecIdentifier,
          config: {
            redirect_url_allowlist: isLaunchable ? ['https://example.com/api/auth'] : [MAGIC_REDIRECT_URL],
            ...(scopesArray && {scopes: scopesArray.map((scope) => scope.trim()).join(',')}),
          },
        },
      ],
    },
    name,
  }
}

// Business platform uses base64-encoded GIDs, while App Management uses
// just the integer portion of that ID. These functions convert between the two.

// 1234 => gid://organization/Organization/1234 => base64
function encodedGidFromId(id: string): string {
  const gid = `gid://organization/Organization/${id}`
  return Buffer.from(gid).toString('base64')
}

// base64 => gid://organization/Organization/1234 => 1234
function idFromEncodedGid(gid: string): string {
  const decodedGid = Buffer.from(gid, 'base64').toString('ascii')
  return numberFromGid(decodedGid).toString()
}

// gid://organization/Organization/1234 => 1234
function numberFromGid(gid: string): number {
  return Number(gid.match(/^gid.*\/(\d+)$/)![1])
}

interface DiffAppModulesInput {
  currentModules: AppModuleReturnType[]
  selectedVersionModules: AppModuleReturnType[]
}

interface DiffAppModulesOutput {
  added: AppModuleReturnType[]
  removed: AppModuleReturnType[]
  updated: AppModuleReturnType[]
}

export function diffAppModules({currentModules, selectedVersionModules}: DiffAppModulesInput): DiffAppModulesOutput {
  const currentModuleUids = currentModules.map((mod) => mod.uid)
  const selectedVersionModuleUids = selectedVersionModules.map((mod) => mod.uid)
  const removed = currentModules.filter((mod) => !selectedVersionModuleUids.includes(mod.uid))
  const added = selectedVersionModules.filter((mod) => !currentModuleUids.includes(mod.uid))
  const addedUids = added.map((mod) => mod.uid)
  const updated = selectedVersionModules.filter((mod) => !addedUids.includes(mod.uid))
  return {added, removed, updated}
}

export async function allowedTemplates(
  templates: GatedExtensionTemplate[],
  betaFlagsFetcher: (betaFlags: string[]) => Promise<{[key: string]: boolean}>,
): Promise<GatedExtensionTemplate[]> {
  const allBetaFlags = Array.from(new Set(templates.map((ext) => ext.organizationBetaFlags ?? []).flat()))
  const enabledBetaFlags = await betaFlagsFetcher(allBetaFlags)
  return templates.filter((ext) => {
    const hasAnyNeededBetas =
      !ext.organizationBetaFlags || ext.organizationBetaFlags.every((flag) => enabledBetaFlags[flag])
    const satisfiesMinCliVersion =
      !ext.minimumCliVersion || versionSatisfies(CLI_KIT_VERSION, `>=${ext.minimumCliVersion}`)
    return hasAnyNeededBetas && satisfiesMinCliVersion
  })
}

async function stubbedExtensionSpecifications(): Promise<RemoteSpecification[]> {
  return [
    {
      name: 'App Nav Item',
      externalName: 'App Nav Item',
      externalIdentifier: 'app_nav_item',
      identifier: 'app_nav_item',
      gated: false,
      experience: 'deprecated',
      options: {managementExperience: 'custom', registrationLimit: 100},
    },
    {
      name: 'Online Store Nav Item',
      externalName: 'Online Store Nav Item',
      externalIdentifier: 'online_store_nav_item',
      identifier: 'online_store_nav_item',
      gated: false,
      experience: 'deprecated',
      options: {managementExperience: 'custom', registrationLimit: 100},
    },
    {
      name: 'POS Link',
      externalName: 'POS Link',
      externalIdentifier: 'pos_link',
      identifier: 'pos_link',
      gated: false,
      experience: 'deprecated',
      options: {managementExperience: 'dashboard', registrationLimit: 100},
    },
    {
      name: 'App Link',
      externalName: 'App Link',
      externalIdentifier: 'app_link',
      identifier: 'app_link',
      gated: false,
      experience: 'deprecated',
      options: {managementExperience: 'dashboard', registrationLimit: 100},
    },
    {
      name: 'Bulk Action',
      externalName: 'Bulk Action',
      externalIdentifier: 'bulk_action',
      identifier: 'bulk_action',
      gated: false,
      experience: 'deprecated',
      options: {managementExperience: 'dashboard', registrationLimit: 100},
    },
    {
      name: 'Flow - Action Definition',
      externalName: 'Flow - Action Definition',
      externalIdentifier: 'flow_action_definition',
      identifier: 'flow_action_definition',
      gated: false,
      experience: 'deprecated',
      options: {managementExperience: 'dashboard', registrationLimit: 100},
    },
    {
      name: 'Flow Action',
      externalName: 'Flow Action',
      externalIdentifier: 'flow_action',
      identifier: 'flow_action',
      gated: true,
      experience: 'extension',
      options: {managementExperience: 'cli', registrationLimit: 100},
    },
    {
      name: 'Flow - Trigger Definition',
      externalName: 'Flow - Trigger Definition',
      externalIdentifier: 'flow_trigger_definition',
      identifier: 'flow_trigger_definition',
      gated: false,
      experience: 'deprecated',
      options: {managementExperience: 'dashboard', registrationLimit: 100},
    },
    {
      name: 'Flow Trigger',
      externalName: 'Flow Trigger',
      externalIdentifier: 'flow_trigger',
      identifier: 'flow_trigger',
      gated: true,
      experience: 'extension',
      options: {managementExperience: 'cli', registrationLimit: 100},
    },
    {
      name: 'Flow - Trigger Discovery Webhook',
      externalName: 'Flow - Trigger Discovery Webhook',
      externalIdentifier: 'flow_trigger_discovery_webhook',
      identifier: 'flow_trigger_discovery_webhook',
      gated: false,
      experience: 'deprecated',
      options: {managementExperience: 'dashboard', registrationLimit: 1},
    },
    {
      name: 'Flow Template',
      externalName: 'Flow Template',
      externalIdentifier: 'flow_template',
      identifier: 'flow_template',
      gated: true,
      experience: 'extension',
      options: {managementExperience: 'cli', registrationLimit: 300},
    },
    {
      name: 'function',
      externalName: 'function',
      externalIdentifier: 'function',
      identifier: 'function',
      gated: false,
      experience: 'extension',
      options: {managementExperience: 'cli', registrationLimit: 100},
    },
    {
      name: 'UI Extension',
      externalName: 'UI Extension',
      externalIdentifier: 'ui_extension',
      identifier: 'ui_extension',
      gated: false,
      experience: 'extension',
      options: {managementExperience: 'cli', registrationLimit: 50},
    },
    {
      name: 'Privacy Compliance Webhooks',
      externalName: 'Privacy Compliance Webhooks',
      externalIdentifier: 'privacy_compliance_webhooks',
      identifier: 'privacy_compliance_webhooks',
      gated: false,
      experience: 'configuration',
      options: {managementExperience: 'cli', registrationLimit: 1},
    },
    {
      name: 'App access',
      externalName: 'App access',
      externalIdentifier: 'app_access',
      identifier: 'app_access',
      gated: false,
      experience: 'configuration',
      options: {managementExperience: 'cli', registrationLimit: 1},
    },
    {
      name: 'Webhooks',
      externalName: 'Webhooks',
      externalIdentifier: 'webhooks',
      identifier: 'webhooks',
      gated: false,
      experience: 'configuration',
      options: {managementExperience: 'cli', registrationLimit: 100},
    },
    {
      name: 'App Proxy',
      externalName: 'App Proxy',
      externalIdentifier: 'app_proxy',
      identifier: 'app_proxy',
      gated: false,
      experience: 'configuration',
      options: {managementExperience: 'cli', registrationLimit: 1},
    },
    {
      name: 'Point Of Sale Configuration',
      externalName: 'Point Of Sale Configuration',
      externalIdentifier: 'point_of_sale',
      identifier: 'point_of_sale',
      gated: false,
      experience: 'configuration',
      options: {managementExperience: 'cli', registrationLimit: 1},
    },
    {
      name: 'App Home',
      externalName: 'App Home',
      externalIdentifier: 'app_home',
      identifier: 'app_home',
      gated: false,
      experience: 'configuration',
      options: {managementExperience: 'cli', registrationLimit: 1},
    },
    {
      name: 'Branding',
      externalName: 'Branding',
      externalIdentifier: 'branding',
      identifier: 'branding',
      gated: false,
      experience: 'configuration',
      options: {managementExperience: 'cli', registrationLimit: 1},
    },
    {
      name: 'Checkout Post Purchase',
      externalName: 'Post-purchase UI',
      externalIdentifier: 'post_purchase_ui',
      identifier: 'checkout_post_purchase',
      gated: false,
      experience: 'extension',
      options: {managementExperience: 'cli', registrationLimit: 1},
    },
    {
      name: 'Checkout Extension',
      externalName: 'Checkout UI',
      externalIdentifier: 'checkout_ui',
      identifier: 'checkout_ui_extension',
      gated: false,
      experience: 'extension',
      options: {managementExperience: 'cli', registrationLimit: 50},
    },
    {
      name: 'Customer Accounts',
      externalName: 'Customer Accounts',
      externalIdentifier: 'customer_accounts_ui_extension',
      identifier: 'customer_accounts_ui_extension',
      gated: false,
      experience: 'extension',
      options: {managementExperience: 'cli', registrationLimit: 10},
    },
    {
      name: 'Merchandising - Create Publication',
      externalName: 'Merchandising - Create Publication',
      externalIdentifier: 'merchandising_create_publication',
      identifier: 'merchandising_create_publication',
      gated: false,
      experience: 'deprecated',
      options: {managementExperience: 'custom', registrationLimit: 1},
    },
    {
      name: 'Merchandising - Fulfillment Variant Details',
      externalName: 'Merchandising - Fulfillment Variant Details',
      externalIdentifier: 'merchandising_fulfillment_variant_details',
      identifier: 'merchandising_fulfillment_variant_details',
      gated: false,
      experience: 'deprecated',
      options: {managementExperience: 'custom', registrationLimit: 1},
    },
    {
      name: 'Product Subscription',
      externalName: 'Subscription UI',
      externalIdentifier: 'subscription_ui',
      identifier: 'subscription_management',
      gated: false,
      experience: 'extension',
      options: {managementExperience: 'cli', registrationLimit: 1},
    },
    {
      name: 'Product Configuration Link',
      externalName: 'Product Configuration Link',
      externalIdentifier: 'product_configuration_link',
      identifier: 'product_configuration_link',
      gated: false,
      experience: 'deprecated',
      options: {managementExperience: 'dashboard', registrationLimit: 1},
    },
    {
      name: 'Marketing Activity',
      externalName: 'Marketing Activity',
      externalIdentifier: 'marketing_activity_extension',
      identifier: 'marketing_activity_extension',
      gated: false,
      experience: 'deprecated',
      options: {managementExperience: 'dashboard', registrationLimit: 100},
    },
    {
      name: 'Web Pixel Extension',
      externalName: 'Web Pixel',
      externalIdentifier: 'web_pixel',
      identifier: 'web_pixel_extension',
      gated: false,
      experience: 'extension',
      options: {managementExperience: 'cli', registrationLimit: 1},
    },
    {
      name: 'Online Store - App Theme Extension',
      externalName: 'Theme App Extension',
      externalIdentifier: 'theme_app_extension',
      identifier: 'theme_app_extension',
      gated: false,
      experience: 'extension',
      options: {managementExperience: 'cli', registrationLimit: 1},
    },
    {
      name: 'Payment Gateway',
      externalName: 'Payment Gateway',
      externalIdentifier: 'payment_gateway',
      identifier: 'payment_gateway',
      gated: false,
      experience: 'deprecated',
      options: {managementExperience: 'custom', registrationLimit: 1},
    },
    {
      name: 'Retail Cart Promotion',
      externalName: 'Retail Cart Promotion',
      externalIdentifier: 'retail_cart_promotion',
      identifier: 'retail_cart_promotion',
      gated: false,
      experience: 'deprecated',
      options: {managementExperience: 'dashboard', registrationLimit: 1},
    },
    {
      name: 'Retail Product Recommendation',
      externalName: 'Retail Product Recommendation',
      externalIdentifier: 'retail_product_recommendation',
      identifier: 'retail_product_recommendation',
      gated: false,
      experience: 'deprecated',
      options: {managementExperience: 'dashboard', registrationLimit: 1},
    },
    {
      name: 'POS UI Extension',
      externalName: 'POS UI',
      externalIdentifier: 'pos_ui',
      identifier: 'pos_ui_extension',
      gated: false,
      experience: 'extension',
      options: {managementExperience: 'cli', registrationLimit: 50},
    },
    {
      name: 'Cloud Terminal Management',
      externalName: 'Cloud Terminal Management',
      externalIdentifier: 'cloud_terminal_management',
      identifier: 'cloud_terminal_management',
      gated: false,
      experience: 'extension',
      options: {managementExperience: 'cli', registrationLimit: 1},
    },
    {
      name: 'Subscription Link',
      externalName: 'Subscription Link',
      externalIdentifier: 'subscription_link',
      identifier: 'subscription_link',
      gated: false,
      experience: 'deprecated',
      options: {managementExperience: 'dashboard', registrationLimit: 1},
    },
  ]
}
