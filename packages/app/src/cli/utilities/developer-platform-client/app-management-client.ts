/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  OrganizationBetaFlagsQuerySchema,
  OrganizationBetaFlagsQueryVariables,
  organizationBetaFlagsQuery,
} from './app-management-client/graphql/organization_beta_flags.js'
import {environmentVariableNames} from '../../constants.js'
import {RemoteSpecification} from '../../api/graphql/extension_specifications.js'
import {
  DeveloperPlatformClient,
  Paginateable,
  AppVersion,
  AppVersionWithContext,
  AppDeployOptions,
  AssetUrlSchema,
  AppVersionIdentifiers,
  DevSessionOptions,
  filterDisabledFlags,
  ClientName,
  AppModuleVersion,
  CreateAppOptions,
} from '../developer-platform-client.js'
import {PartnersSession} from '../../services/context/partner-account-info.js'
import {
  MinimalAppIdentifiers,
  AppApiKeyAndOrgId,
  MinimalOrganizationApp,
  Organization,
  OrganizationApp,
  OrganizationSource,
  OrganizationStore,
} from '../../models/organization.js'
import {
  AllAppExtensionRegistrationsQuerySchema,
  ExtensionRegistration,
} from '../../api/graphql/all_app_extension_registrations.js'
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
import {AppVersionsDiffSchema} from '../../api/graphql/app_versions_diff.js'
import {
  SampleWebhook,
  SendSampleWebhookSchema,
  SendSampleWebhookVariables,
} from '../../services/webhook/request-sample.js'
import {PublicApiVersionsSchema} from '../../services/webhook/request-api-versions.js'
import {WebhookTopicsSchema, WebhookTopicsVariables} from '../../services/webhook/request-topics.js'
import {
  MigrateFlowExtensionSchema,
  MigrateFlowExtensionVariables,
} from '../../api/graphql/extension_migrate_flow_extension.js'
import {UpdateURLsSchema, UpdateURLsVariables} from '../../api/graphql/update_urls.js'
import {CurrentAccountInfoSchema} from '../../api/graphql/current_account_info.js'
import {ExtensionTemplate} from '../../models/app/template.js'
import {
  MigrateToUiExtensionVariables,
  MigrateToUiExtensionSchema,
} from '../../api/graphql/extension_migrate_to_ui_extension.js'
import {MigrateAppModuleSchema, MigrateAppModuleVariables} from '../../api/graphql/extension_migrate_app_module.js'
import {AppLogsSubscribeVariables, AppLogsSubscribeResponse} from '../../api/graphql/subscribe_to_app_logs.js'
import {
  ExtensionUpdateDraftMutation,
  ExtensionUpdateDraftMutationVariables,
} from '../../api/graphql/partners/generated/update-draft.js'
import {ListOrganizations} from '../../api/graphql/business-platform-destinations/generated/organizations.js'
import {AppHomeSpecIdentifier} from '../../models/extensions/specifications/app_config_app_home.js'
import {BrandingSpecIdentifier} from '../../models/extensions/specifications/app_config_branding.js'
import {AppAccessSpecIdentifier} from '../../models/extensions/specifications/app_config_app_access.js'
import {CONFIG_EXTENSION_IDS} from '../../models/extensions/extension-instance.js'
import {DevSessionCreate, DevSessionCreateMutation} from '../../api/graphql/app-dev/generated/dev-session-create.js'
import {DevSessionUpdate, DevSessionUpdateMutation} from '../../api/graphql/app-dev/generated/dev-session-update.js'
import {DevSessionDelete, DevSessionDeleteMutation} from '../../api/graphql/app-dev/generated/dev-session-delete.js'
import {
  FetchDevStoreByDomain,
  FetchDevStoreByDomainQueryVariables,
} from '../../api/graphql/business-platform-organizations/generated/fetch_dev_store_by_domain.js'
import {
  ListAppDevStores,
  ListAppDevStoresQuery,
} from '../../api/graphql/business-platform-organizations/generated/list_app_dev_stores.js'
import {
  ActiveAppReleaseQuery,
  ReleasedAppModuleFragment,
} from '../../api/graphql/app-management/generated/active-app-release.js'
import {ActiveAppReleaseFromApiKey} from '../../api/graphql/app-management/generated/active-app-release-from-api-key.js'
import {ReleaseVersion} from '../../api/graphql/app-management/generated/release-version.js'
import {CreateAppVersion} from '../../api/graphql/app-management/generated/create-app-version.js'
import {CreateAssetUrl} from '../../api/graphql/app-management/generated/create-asset-url.js'
import {AppVersionById} from '../../api/graphql/app-management/generated/app-version-by-id.js'
import {AppVersions} from '../../api/graphql/app-management/generated/app-versions.js'
import {CreateApp, CreateAppMutationVariables} from '../../api/graphql/app-management/generated/create-app.js'
import {FetchSpecifications} from '../../api/graphql/app-management/generated/specifications.js'
import {ListApps} from '../../api/graphql/app-management/generated/apps.js'
import {FindOrganizations} from '../../api/graphql/business-platform-destinations/generated/find-organizations.js'
import {UserInfo} from '../../api/graphql/business-platform-destinations/generated/user-info.js'
import {AvailableTopics} from '../../api/graphql/webhooks/generated/available-topics.js'
import {CliTesting} from '../../api/graphql/webhooks/generated/cli-testing.js'
import {PublicApiVersions} from '../../api/graphql/webhooks/generated/public-api-versions.js'
import {
  SchemaDefinitionByTarget,
  SchemaDefinitionByTargetQuery,
  SchemaDefinitionByTargetQueryVariables,
} from '../../api/graphql/functions/generated/schema-definition-by-target.js'
import {
  SchemaDefinitionByApiType,
  SchemaDefinitionByApiTypeQuery,
  SchemaDefinitionByApiTypeQueryVariables,
} from '../../api/graphql/functions/generated/schema-definition-by-api-type.js'
import {WebhooksSpecIdentifier} from '../../models/extensions/specifications/app_config_webhook.js'
import {AppVersionByTag} from '../../api/graphql/app-management/generated/app-version-by-tag.js'
import {ensureAuthenticatedAppManagementAndBusinessPlatform} from '@shopify/cli-kit/node/session'
import {isUnitTest} from '@shopify/cli-kit/node/context/local'
import {AbortError, BugError} from '@shopify/cli-kit/node/error'
import {fetch} from '@shopify/cli-kit/node/http'
import {appManagementRequestDoc} from '@shopify/cli-kit/node/api/app-management'
import {appDevRequest} from '@shopify/cli-kit/node/api/app-dev'
import {
  businessPlatformOrganizationsRequest,
  businessPlatformOrganizationsRequestDoc,
  businessPlatformRequestDoc,
} from '@shopify/cli-kit/node/api/business-platform'
import {CLI_KIT_VERSION} from '@shopify/cli-kit/common/version'
import {versionSatisfies} from '@shopify/cli-kit/node/node-package-manager'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {developerDashboardFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {webhooksRequest} from '@shopify/cli-kit/node/api/webhooks'
import {functionsRequestDoc} from '@shopify/cli-kit/node/api/functions'
import {fileExists, readFile} from '@shopify/cli-kit/node/fs'
import {JsonMapType} from '@shopify/cli-kit/node/toml'

const TEMPLATE_JSON_URL = 'https://cdn.shopify.com/static/cli/extensions/templates.json'

type OrgType = NonNullable<ListAppDevStoresQuery['organization']>
type AccessibleShops = NonNullable<OrgType['accessibleShops']>
type ShopEdge = NonNullable<AccessibleShops['edges'][number]>
type ShopNode = Exclude<ShopEdge['node'], {[key: string]: never}>
export interface GatedExtensionTemplate extends ExtensionTemplate {
  organizationBetaFlags?: string[]
  minimumCliVersion?: string
}

export class AppManagementClient implements DeveloperPlatformClient {
  public readonly clientName = ClientName.AppManagement
  public readonly webUiName = 'Developer Dashboard'
  public readonly requiresOrganization = true
  public readonly supportsAtomicDeployments = true
  public readonly supportsDevSessions = true
  public readonly supportsStoreSearch = true
  public readonly organizationSource = OrganizationSource.BusinessPlatform
  private _session: PartnersSession | undefined

  constructor(session?: PartnersSession) {
    this._session = session
  }

  async subscribeToAppLogs(input: AppLogsSubscribeVariables): Promise<AppLogsSubscribeResponse> {
    throw new Error(`Not Implemented: ${JSON.stringify(input)}`)
  }

  async session(): Promise<PartnersSession> {
    if (!this._session) {
      if (isUnitTest()) {
        throw new Error('AppManagementClient.session() should not be invoked dynamically in a unit test')
      }

      const tokenResult = await ensureAuthenticatedAppManagementAndBusinessPlatform()
      const {appManagementToken, businessPlatformToken, userId} = tokenResult

      const userInfoResult = await businessPlatformRequestDoc(UserInfo, businessPlatformToken, undefined, {
        cacheTTL: {hours: 6},
        cacheExtraKey: userId,
      })

      if (userInfoResult.currentUserAccount) {
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

  async refreshToken(): Promise<string> {
    const result = await ensureAuthenticatedAppManagementAndBusinessPlatform({noPrompt: true})
    const session = await this.session()
    session.token = result.appManagementToken
    session.businessPlatformToken = result.businessPlatformToken

    return session.token
  }

  async accountInfo(): Promise<PartnersSession['accountInfo']> {
    return (await this.session()).accountInfo
  }

  async appFromIdentifiers(appIdentifiers: AppApiKeyAndOrgId): Promise<OrganizationApp | undefined> {
    const {app} = await this.activeAppVersionRawResult(appIdentifiers)
    const {name, appModules} = app.activeRelease.version
    const appAccessModule = appModules.find((mod) => mod.specification.externalIdentifier === 'app_access')
    const appHomeModule = appModules.find((mod) => mod.specification.externalIdentifier === 'app_home')
    const apiSecretKeys = app.activeRoot.clientCredentials.secrets.map((secret) => ({secret: secret.key}))
    return {
      id: app.id,
      title: name,
      apiKey: app.key,
      apiSecretKeys,
      organizationId: appIdentifiers.organizationId,
      grantedScopes: (appAccessModule?.config?.scopes as string[] | undefined) ?? [],
      applicationUrl: appHomeModule?.config?.app_url as string | undefined,
      flags: [],
      developerPlatformClient: this,
    }
  }

  async organizations(): Promise<Organization[]> {
    const organizationsResult = await businessPlatformRequestDoc(ListOrganizations, await this.businessPlatformToken())
    if (!organizationsResult.currentUserAccount) return []
    return organizationsResult.currentUserAccount.organizations.nodes.map((org) => ({
      id: idFromEncodedGid(org.id),
      businessName: org.name,
      source: this.organizationSource,
    }))
  }

  async orgFromId(orgId: string): Promise<Organization | undefined> {
    const base64Id = encodedGidFromId(orgId)
    const variables = {organizationId: base64Id}
    const organizationResult = await businessPlatformRequestDoc(
      FindOrganizations,
      await this.businessPlatformToken(),
      variables,
      {cacheTTL: {hours: 6}},
    )
    const org = organizationResult.currentUserAccount?.organization
    if (!org) {
      return
    }
    return {
      id: orgId,
      businessName: org.name,
      source: this.organizationSource,
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

  async appsForOrg(organizationId: string, term = ''): Promise<Paginateable<{apps: MinimalOrganizationApp[]}>> {
    const query = ListApps
    const variables = {
      query: term
        .split(' ')
        .filter((word) => word)
        .map((word) => `title:${word}`)
        .join(' '),
    }
    const result = await appManagementRequestDoc(organizationId, query, await this.token(), variables)
    if (!result.appsConnection) {
      throw new BugError('Server failed to retrieve apps')
    }
    const minimalOrganizationApps = result.appsConnection.edges.map((edge) => {
      const app = edge.node
      return {
        id: app.id,
        apiKey: app.key,
        title: app.activeRelease.version.name,
        organizationId,
      }
    })
    return {
      apps: minimalOrganizationApps,
      hasMorePages: result.appsConnection.pageInfo.hasNextPage,
    }
  }

  async specifications({organizationId}: MinimalAppIdentifiers): Promise<RemoteSpecification[]> {
    const query = FetchSpecifications
    const result = await appManagementRequestDoc(organizationId, query, await this.token(), undefined, {
      cacheTTL: {hours: 6},
    })
    return result.specifications.map(
      (spec): RemoteSpecification => ({
        name: spec.name,
        externalName: spec.name,
        identifier: spec.identifier,
        externalIdentifier: spec.externalIdentifier,
        gated: false,
        options: {
          managementExperience: 'cli',
          registrationLimit: spec.uidStrategy.appModuleLimit,
          uidIsClientProvided: spec.uidStrategy.isClientProvided,
        },
        experience: experience(spec.identifier),
        validationSchema: spec.validationSchema,
      }),
    )
  }

  async templateSpecifications({organizationId}: MinimalAppIdentifiers): Promise<ExtensionTemplate[]> {
    let templates: GatedExtensionTemplate[]
    const {templatesJsonPath} = environmentVariableNames
    const overrideFile = process.env[templatesJsonPath]
    if (overrideFile) {
      if (!(await fileExists(overrideFile))) {
        throw new AbortError('There is no file at the path specified for template specifications')
      }
      const templatesJson = await readFile(overrideFile)
      templates = JSON.parse(templatesJson)
    } else {
      try {
        const response = await fetch(TEMPLATE_JSON_URL)
        templates = await (response.json() as Promise<GatedExtensionTemplate[]>)
      } catch (_e) {
        throw new AbortError([
          'Failed to fetch extension templates from',
          {link: {url: TEMPLATE_JSON_URL}},
          {char: '.'},
          'This likely means a problem with your internet connection.',
        ])
      }
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

  async createApp(org: Organization, options: CreateAppOptions): Promise<OrganizationApp> {
    // Query for latest api version
    const apiVersions = await this.apiVersions(org.id)
    const apiVersion =
      apiVersions.publicApiVersions
        .filter((version) => version !== 'unstable')
        .sort()
        .at(-1) ?? 'unstable'

    const variables = createAppVars(options, apiVersion)

    const mutation = CreateApp
    const result = await appManagementRequestDoc(org.id, mutation, await this.token(), variables)
    if (!result.appCreate.app || result.appCreate.userErrors?.length > 0) {
      const errors = result.appCreate.userErrors.map((error) => error.message).join(', ')
      throw new AbortError(errors)
    }

    // Need to figure this out still
    const flags = filterDisabledFlags([])
    const createdApp = result.appCreate.app
    const apiSecretKeys = createdApp.activeRoot.clientCredentials.secrets.map((secret) => ({secret: secret.key}))
    return {
      ...createdApp,
      title: options.name,
      apiKey: createdApp.key,
      apiSecretKeys,
      grantedScopes: options?.scopesArray ?? [],
      organizationId: org.id,
      newApp: true,
      flags,
      developerPlatformClient: this,
    }
  }

  // we are returning OrganizationStore type here because we want to keep types consistent btwn
  // partners-client and app-management-client. Since we need transferDisabled and convertableToPartnerTest values
  // from the Partners OrganizationStore schema, we will return this type for now
  async devStoresForOrg(orgId: string, searchTerm?: string): Promise<Paginateable<{stores: OrganizationStore[]}>> {
    const storesResult = await businessPlatformOrganizationsRequestDoc<ListAppDevStoresQuery>(
      ListAppDevStores,
      await this.businessPlatformToken(),
      orgId,
      {searchTerm},
    )
    const organization = storesResult.organization

    if (!organization) {
      throw new AbortError(`No organization found`)
    }

    const shopArray = organization.accessibleShops?.edges.map((value) => value.node) ?? []
    return {
      stores: mapBusinessPlatformStoresToOrganizationStores(shopArray),
      hasMorePages: storesResult.organization?.accessibleShops?.pageInfo.hasNextPage ?? false,
    }
  }

  async appExtensionRegistrations(
    appIdentifiers: MinimalAppIdentifiers,
    activeAppVersion?: AppVersion,
  ): Promise<AllAppExtensionRegistrationsQuerySchema> {
    const app = activeAppVersion ?? (await this.activeAppVersion(appIdentifiers))

    const configurationRegistrations: ExtensionRegistration[] = []
    const extensionRegistrations: ExtensionRegistration[] = []
    app.appModuleVersions.forEach((mod) => {
      const registration = {
        id: mod.registrationId,
        uuid: mod.registrationUuid!,
        title: mod.registrationTitle,
        type: mod.type,
      }
      if (CONFIG_EXTENSION_IDS.includes(registration.id)) {
        configurationRegistrations.push(registration)
      } else {
        extensionRegistrations.push(registration)
      }
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
    const query = AppVersions
    const variables = {appId: id}
    const result = await appManagementRequestDoc(organizationId, query, await this.token(), variables)
    return {
      app: {
        id: result.app.id,
        organizationId,
        title,
        appVersions: {
          nodes: result.versions.map((version) => {
            return {
              createdAt: version.createdAt,
              createdBy: {
                displayName: version.createdBy,
              },
              versionTag: version.metadata.versionTag,
              status: version.id === result.app.activeRelease.version.id ? 'active' : 'inactive',
              versionId: version.id,
              message: version.metadata.message,
            }
          }),
          pageInfo: {
            totalResults: result.versions.length,
          },
        },
      },
    }
  }

  async appVersionByTag(
    {id: appId, organizationId}: MinimalOrganizationApp,
    versionTag: string,
  ): Promise<AppVersionWithContext> {
    const query = AppVersionByTag
    const variables = {versionTag}
    const result = await appManagementRequestDoc(organizationId, query, await this.token(), variables)
    const version = result.versionByTag
    if (!version) {
      throw new AbortError(`Version not found for tag: ${versionTag}`)
    }

    return {
      id: parseInt(version.id, 10),
      uuid: version.id,
      versionTag: version.metadata.versionTag,
      location: [await appDeepLink({organizationId, id: appId}), 'versions', numberFromGid(version.id)].join('/'),
      message: version.metadata.message ?? '',
      appModuleVersions: version.appModules.map(appModuleVersion),
    }
  }

  async appVersionsDiff(
    app: MinimalOrganizationApp,
    {versionId}: AppVersionIdentifiers,
  ): Promise<AppVersionsDiffSchema> {
    const variables = {versionId}
    const [currentVersion, selectedVersion] = await Promise.all([
      this.activeAppVersionRawResult(app),
      appManagementRequestDoc(app.organizationId, AppVersionById, await this.token(), variables),
    ])
    const currentModules = currentVersion.app.activeRelease.version.appModules
    const selectedVersionModules = selectedVersion.version.appModules
    const {added, removed, updated} = diffAppModules({currentModules, selectedVersionModules})

    function formattedModule(mod: ReleasedAppModuleFragment) {
      return {
        uuid: mod.uuid,
        registrationTitle: mod.handle,
        specification: {
          identifier: mod.specification.identifier,
          experience: experience(mod.specification.identifier),
          options: {
            managementExperience: 'cli',
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

  async activeAppVersion(app: MinimalAppIdentifiers): Promise<AppVersion> {
    const result = await this.activeAppVersionRawResult(app)
    return {
      appModuleVersions: result.app.activeRelease.version.appModules.map(appModuleVersion),
      ...result.app.activeRelease,
    }
  }

  async generateSignedUploadUrl({organizationId}: MinimalAppIdentifiers): Promise<AssetUrlSchema> {
    const result = await appManagementRequestDoc(organizationId, CreateAssetUrl, await this.token())
    return {
      assetUrl: result.appRequestSourceUploadUrl.sourceUploadUrl,
      userErrors: result.appRequestSourceUploadUrl.userErrors,
    }
  }

  async updateExtension(_extensionInput: ExtensionUpdateDraftMutationVariables): Promise<ExtensionUpdateDraftMutation> {
    throw new BugError('Not implemented: updateExtension')
  }

  async deploy({
    appId,
    name,
    appModules,
    organizationId,
    versionTag,
    message,
    commitReference,
    bundleUrl,
    skipPublish: noRelease,
  }: AppDeployOptions): Promise<AppDeploySchema> {
    // `name` is from the package.json package name or the directory name, while
    // the branding module reflects the current specified name in the TOML.
    // Since it is technically valid to not have a branding module, we will default
    // to the `name` if no branding module is present.
    let updatedName = name
    const brandingModule = appModules?.find((mod) => mod.specificationIdentifier === BrandingSpecIdentifier)
    if (brandingModule) {
      updatedName = JSON.parse(brandingModule.config).name
    }
    const metadata = {versionTag, message, sourceControlUrl: commitReference}
    const queryVersion: AppVersionSourceUrl | AppVersionSource = bundleUrl
      ? {sourceUrl: bundleUrl}
      : {
          source: {
            name: updatedName,
            modules: (appModules ?? []).map((mod) => ({
              uid: mod.uid ?? mod.uuid ?? mod.handle,
              type: mod.specificationIdentifier,
              handle: mod.handle,
              config: JSON.parse(mod.config),
            })),
          },
        }
    const variables = {
      appId,
      version: queryVersion as unknown as JsonMapType,
      metadata,
    }

    const result = await appManagementRequestDoc(organizationId, CreateAppVersion, await this.token(), variables)
    const {version, userErrors} = result.appVersionCreate
    if (!version) return {appDeploy: {userErrors}} as unknown as AppDeploySchema

    const versionResult = {
      appDeploy: {
        appVersion: {
          uuid: version.id,
          // Need to deal with ID properly as it's expected to be a number... how do we use it?
          id: parseInt(version.id, 10),
          versionTag: version.metadata.versionTag,
          location: await versionDeepLink(organizationId, appId, version.id),
          appModuleVersions: version.appModules.map((mod) => {
            return {
              uuid: mod.uuid,
              registrationUuid: mod.uuid,
              validationErrors: [],
            }
          }),
          message: version.metadata.message,
        },
        userErrors: userErrors?.map((err) => ({...err, details: []})),
      },
    }
    if (noRelease) return versionResult

    const releaseVariables = {appId, versionId: version.id}
    const releaseResult = await appManagementRequestDoc(
      organizationId,
      ReleaseVersion,
      await this.token(),
      releaseVariables,
    )
    if (releaseResult.appReleaseCreate?.userErrors) {
      versionResult.appDeploy.userErrors = (versionResult.appDeploy.userErrors ?? []).concat(
        releaseResult.appReleaseCreate.userErrors.map((err) => ({...err, details: []})),
      )
    }

    return versionResult
  }

  async release({
    app: {id: appId, organizationId},
    version: {versionId},
  }: {
    app: MinimalOrganizationApp
    version: AppVersionIdentifiers
  }): Promise<AppReleaseSchema> {
    const releaseVariables = {appId, versionId}
    const releaseResult = await appManagementRequestDoc(
      organizationId,
      ReleaseVersion,
      await this.token(),
      releaseVariables,
    )
    if (!releaseResult.appReleaseCreate?.release) {
      throw new AbortError('Failed to release version')
    }
    return {
      appRelease: {
        appVersion: {
          versionTag: releaseResult.appReleaseCreate.release.version.metadata.versionTag,
          message: releaseResult.appReleaseCreate.release.version.metadata.message,
          location: [
            await appDeepLink({organizationId, id: appId}),
            'versions',
            numberFromGid(releaseResult.appReleaseCreate.release.version.id),
          ].join('/'),
        },
        userErrors: releaseResult.appReleaseCreate.userErrors?.map((err) => ({
          field: err.field,
          message: err.message,
          category: '',
          details: [],
        })),
      },
    }
  }

  // we are using FindStoreByDomainSchema type here because we want to keep types consistent btwn
  // partners-client and app-management-client. Since we need transferDisabled and convertableToPartnerTest values
  // from the Partners FindByStoreDomainSchema, we will return this type for now
  async storeByDomain(orgId: string, shopDomain: string): Promise<FindStoreByDomainSchema> {
    const queryVariables: FetchDevStoreByDomainQueryVariables = {domain: shopDomain}
    const storesResult = await businessPlatformOrganizationsRequestDoc(
      FetchDevStoreByDomain,
      await this.businessPlatformToken(),
      orgId,
      queryVariables,
    )

    const organization = storesResult.organization

    if (!organization) {
      throw new AbortError(`No organization found`)
    }

    const bpStoresArray = organization.accessibleShops?.edges.map((value) => value.node) ?? []
    const storesArray = mapBusinessPlatformStoresToOrganizationStores(bpStoresArray)

    return {
      organizations: {
        nodes: [
          {
            id: organization.id,
            businessName: organization.name,
            stores: {
              nodes: storesArray,
            },
          },
        ],
      },
    }
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

  async sendSampleWebhook(input: SendSampleWebhookVariables, organizationId: string): Promise<SendSampleWebhookSchema> {
    const query = CliTesting
    const variables = {
      address: input.address,
      apiKey: input.api_key,
      apiVersion: input.api_version,
      deliveryMethod: input.delivery_method,
      sharedSecret: input.shared_secret,
      topic: input.topic,
    }
    const result = await webhooksRequest(organizationId, query, await this.token(), variables)
    let sendSampleWebhook: SampleWebhook = {samplePayload: '{}', headers: '{}', success: false, userErrors: []}
    const cliTesting = result.cliTesting
    if (cliTesting) {
      sendSampleWebhook = {
        samplePayload: cliTesting.samplePayload ?? '{}',
        headers: cliTesting.headers ?? '{}',
        success: cliTesting.success,
        userErrors: cliTesting.errors.map((error) => ({message: error, fields: []})),
      }
    }
    return {sendSampleWebhook}
  }

  async apiVersions(organizationId: string): Promise<PublicApiVersionsSchema> {
    const result = await webhooksRequest(organizationId, PublicApiVersions, await this.token(), {})
    return {publicApiVersions: result.publicApiVersions.map((version) => version.handle)}
  }

  async topics(
    {api_version: apiVersion}: WebhookTopicsVariables,
    organizationId: string,
  ): Promise<WebhookTopicsSchema> {
    const query = AvailableTopics
    const variables = {apiVersion}
    const result = await webhooksRequest(organizationId, query, await this.token(), variables)

    return {
      webhookTopics: result.availableTopics ?? [],
    }
  }

  async migrateFlowExtension(_input: MigrateFlowExtensionVariables): Promise<MigrateFlowExtensionSchema> {
    throw new BugError('Not implemented: migrateFlowExtension')
  }

  async migrateAppModule(_input: MigrateAppModuleVariables): Promise<MigrateAppModuleSchema> {
    throw new BugError('Not implemented: migrateAppModule')
  }

  async updateURLs(_input: UpdateURLsVariables): Promise<UpdateURLsSchema> {
    outputDebug('⚠️ updateURLs is not implemented')
    return {appUpdate: {userErrors: []}}
  }

  async currentAccountInfo(): Promise<CurrentAccountInfoSchema> {
    throw new BugError('Not implemented: currentAccountInfo')
  }

  async targetSchemaDefinition(
    input: SchemaDefinitionByTargetQueryVariables,
    apiKey: string,
    organizationId: string,
  ): Promise<string | null> {
    try {
      const {app} = await this.activeAppVersionRawResult({apiKey, organizationId})
      const appIdNumber = String(numberFromGid(app.id))
      const token = await this.token()
      const result = await functionsRequestDoc<SchemaDefinitionByTargetQuery, SchemaDefinitionByTargetQueryVariables>(
        organizationId,
        SchemaDefinitionByTarget,
        token,
        appIdNumber,
        {
          handle: input.handle,
          version: input.version,
        },
      )

      return result?.target?.api?.schema?.definition ?? null
    } catch (error) {
      throw new AbortError(`Failed to fetch schema definition: ${error}`)
    }
  }

  async apiSchemaDefinition(
    input: SchemaDefinitionByApiTypeQueryVariables,
    apiKey: string,
    organizationId: string,
  ): Promise<string | null> {
    try {
      const {app} = await this.activeAppVersionRawResult({apiKey, organizationId})
      const appIdNumber = String(numberFromGid(app.id))
      const token = await this.token()
      const result = await functionsRequestDoc<SchemaDefinitionByApiTypeQuery, SchemaDefinitionByApiTypeQueryVariables>(
        organizationId,
        SchemaDefinitionByApiType,
        token,
        appIdNumber,
        input,
      )

      return result?.api?.schema?.definition ?? null
    } catch (error) {
      throw new AbortError(`Failed to fetch schema definition: ${error}`)
    }
  }

  async migrateToUiExtension(_input: MigrateToUiExtensionVariables): Promise<MigrateToUiExtensionSchema> {
    throw new BugError('Not implemented: migrateToUiExtension')
  }

  toExtensionGraphQLType(input: string) {
    return input.toLowerCase()
  }

  async appDeepLink({id, organizationId}: Pick<MinimalAppIdentifiers, 'id' | 'organizationId'>): Promise<string> {
    return appDeepLink({id, organizationId})
  }

  async devSessionCreate({appId, assetsUrl, shopFqdn}: DevSessionOptions): Promise<DevSessionCreateMutation> {
    const appIdNumber = String(numberFromGid(appId))
    return appDevRequest(DevSessionCreate, shopFqdn, await this.token(), {appId: appIdNumber, assetsUrl})
  }

  async devSessionUpdate({appId, assetsUrl, shopFqdn}: DevSessionOptions): Promise<DevSessionUpdateMutation> {
    const appIdNumber = String(numberFromGid(appId))
    return appDevRequest(DevSessionUpdate, shopFqdn, await this.token(), {appId: appIdNumber, assetsUrl})
  }

  async devSessionDelete({appId, shopFqdn}: Omit<DevSessionOptions, 'assetsUrl'>): Promise<DevSessionDeleteMutation> {
    const appIdNumber = String(numberFromGid(appId))
    return appDevRequest(DevSessionDelete, shopFqdn, await this.token(), {appId: appIdNumber})
  }

  async getCreateDevStoreLink(orgId: string): Promise<string> {
    const url = `https://${await developerDashboardFqdn()}/dashboard/${orgId}/stores`
    return (
      `Looks like you don't have a dev store in the organization you selected. ` +
      `Keep going — create a dev store on the Developer Dashboard:\n${url}\n`
    )
  }

  private async activeAppVersionRawResult({organizationId, apiKey}: AppApiKeyAndOrgId): Promise<ActiveAppReleaseQuery> {
    return appManagementRequestDoc(organizationId, ActiveAppReleaseFromApiKey, await this.token(), {apiKey})
  }

  private async organizationBetaFlags(
    organizationId: string,
    allBetaFlags: string[],
  ): Promise<{[flag: (typeof allBetaFlags)[number]]: boolean}> {
    const variables: OrganizationBetaFlagsQueryVariables = {organizationId: encodedGidFromId(organizationId)}
    const flagsResult = await businessPlatformOrganizationsRequest<OrganizationBetaFlagsQuerySchema>(
      organizationBetaFlagsQuery(allBetaFlags),
      await this.businessPlatformToken(),
      organizationId,
      variables,
    )
    const result: {[flag: (typeof allBetaFlags)[number]]: boolean} = {}
    allBetaFlags.forEach((flag) => {
      result[flag] = Boolean(flagsResult.organization[`flag_${flag}`])
    })
    return result
  }
}

interface AppVersionSource {
  source: {
    name: string
    modules: {
      uid?: string
      type: string
      handle?: string
      config: {[key: string]: unknown}
    }[]
  }
}

interface AppVersionSourceUrl {
  sourceUrl: string
}

// this is a temporary solution for editions to support https://vault.shopify.io/gsd/projects/31406
// read more here: https://vault.shopify.io/gsd/projects/31406
const MAGIC_URL = 'https://shopify.dev/apps/default-app-home'
const MAGIC_REDIRECT_URL = 'https://shopify.dev/apps/default-app-home/api/auth'

function createAppVars(options: CreateAppOptions, apiVersion?: string): CreateAppMutationVariables {
  const {isLaunchable, scopesArray, name, isEmbedded} = options
  const source: AppVersionSource = {
    source: {
      name,
      modules: [
        {
          type: AppHomeSpecIdentifier,
          config: {
            app_url: isLaunchable ? 'https://example.com' : MAGIC_URL,
            embedded: isEmbedded,
          },
        },
        {
          type: BrandingSpecIdentifier,
          config: {name},
        },
        {
          type: WebhooksSpecIdentifier,
          config: {api_version: apiVersion},
        },
        {
          type: AppAccessSpecIdentifier,
          config: {
            redirect_url_allowlist: isLaunchable ? ['https://example.com/api/auth'] : [MAGIC_REDIRECT_URL],
            ...(scopesArray && {scopes: scopesArray.map((scope) => scope.trim()).join(',')}),
          },
        },
      ],
    },
  }

  return {initialVersion: {source: source.source as unknown as JsonMapType}}
}

// Business platform uses base64-encoded GIDs, while App Management uses
// just the integer portion of that ID. These functions convert between the two.

// 1234 => gid://organization/Organization/1234 => base64
export function encodedGidFromId(id: string): string {
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

async function appDeepLink({
  id,
  organizationId,
}: Pick<MinimalAppIdentifiers, 'id' | 'organizationId'>): Promise<string> {
  return `https://${await developerDashboardFqdn()}/dashboard/${organizationId}/apps/${numberFromGid(id)}`
}

export async function versionDeepLink(organizationId: string, appId: string, versionId: string): Promise<string> {
  const appLink = await appDeepLink({organizationId, id: appId})
  return `${appLink}/versions/${numberFromGid(versionId)}`
}

interface DiffAppModulesInput {
  currentModules: ReleasedAppModuleFragment[]
  selectedVersionModules: ReleasedAppModuleFragment[]
}

interface DiffAppModulesOutput {
  added: ReleasedAppModuleFragment[]
  removed: ReleasedAppModuleFragment[]
  updated: ReleasedAppModuleFragment[]
}

export function diffAppModules({currentModules, selectedVersionModules}: DiffAppModulesInput): DiffAppModulesOutput {
  const currentModuleUids = currentModules.map((mod) => mod.userIdentifier)
  const selectedVersionModuleUids = selectedVersionModules.map((mod) => mod.userIdentifier)
  const added = selectedVersionModules.filter((mod) => !currentModuleUids.includes(mod.userIdentifier))
  const removed = currentModules.filter((mod) => !selectedVersionModuleUids.includes(mod.userIdentifier))
  const removedUids = removed.map((mod) => mod.userIdentifier)
  const updated = currentModules.filter((mod) => !removedUids.includes(mod.userIdentifier))
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

function experience(identifier: string): 'configuration' | 'extension' {
  return CONFIG_EXTENSION_IDS.includes(identifier) ? 'configuration' : 'extension'
}

function mapBusinessPlatformStoresToOrganizationStores(storesArray: ShopNode[]): OrganizationStore[] {
  return storesArray.map((store: ShopNode) => {
    const {externalId, primaryDomain, name} = store
    return {
      shopId: externalId ? idFromEncodedGid(externalId) : undefined,
      link: primaryDomain,
      shopDomain: primaryDomain,
      shopName: name,
      transferDisabled: true,
      convertableToPartnerTest: true,
    } as OrganizationStore
  })
}

function appModuleVersion(mod: ReleasedAppModuleFragment): Required<AppModuleVersion> {
  return {
    registrationId: mod.userIdentifier,
    registrationUuid: mod.userIdentifier,
    registrationTitle: mod.handle,
    type: mod.specification.externalIdentifier,
    config: mod.config,
    specification: {
      ...mod.specification,
      identifier: mod.specification.identifier,
      options: {managementExperience: 'cli'},
      experience: experience(mod.specification.identifier),
    },
  }
}
