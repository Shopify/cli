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
  filterDisabledFlags,
  ClientName,
  AppModuleVersion,
  CreateAppOptions,
  AppLogsResponse,
  createUnauthorizedHandler,
  DevSessionUpdateOptions,
  DevSessionCreateOptions,
  DevSessionDeleteOptions,
  UserError,
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
import {
  AllAppExtensionRegistrationsQuerySchema,
  ExtensionRegistration,
} from '../../api/graphql/all_app_extension_registrations.js'
import {AppDeploySchema} from '../../api/graphql/app_deploy.js'
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
import {ExtensionTemplate, ExtensionTemplatesResult} from '../../models/app/template.js'
import {
  MigrateToUiExtensionVariables,
  MigrateToUiExtensionSchema,
} from '../../api/graphql/extension_migrate_to_ui_extension.js'
import {MigrateAppModuleSchema, MigrateAppModuleVariables} from '../../api/graphql/extension_migrate_app_module.js'
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
import {
  DevSessionUpdate,
  DevSessionUpdateMutation,
  DevSessionUpdateMutationVariables,
} from '../../api/graphql/app-dev/generated/dev-session-update.js'
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
  ProvisionShopAccess,
  ProvisionShopAccessMutationVariables,
} from '../../api/graphql/business-platform-organizations/generated/provision_shop_access.js'
import {
  ActiveAppReleaseQuery,
  ReleasedAppModuleFragment,
} from '../../api/graphql/app-management/generated/active-app-release.js'
import {ActiveAppReleaseFromApiKey} from '../../api/graphql/app-management/generated/active-app-release-from-api-key.js'
import {ReleaseVersion} from '../../api/graphql/app-management/generated/release-version.js'
import {
  CreateAppVersion,
  CreateAppVersionMutation,
  CreateAppVersionMutationVariables,
} from '../../api/graphql/app-management/generated/create-app-version.js'
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
  SchemaDefinitionByTargetQueryVariables,
} from '../../api/graphql/functions/generated/schema-definition-by-target.js'
import {
  SchemaDefinitionByApiType,
  SchemaDefinitionByApiTypeQueryVariables,
} from '../../api/graphql/functions/generated/schema-definition-by-api-type.js'
import {WebhooksSpecIdentifier} from '../../models/extensions/specifications/app_config_webhook.js'
import {AppVersionByTag} from '../../api/graphql/app-management/generated/app-version-by-tag.js'
import {AppLogData} from '../../services/app-logs/types.js'
import {
  AppLogsSubscribe,
  AppLogsSubscribeMutation,
  AppLogsSubscribeMutationVariables,
} from '../../api/graphql/app-management/generated/app-logs-subscribe.js'
import {SourceExtension} from '../../api/graphql/app-management/generated/types.js'
import {getPartnersToken} from '@shopify/cli-kit/node/environment'
import {ensureAuthenticatedAppManagementAndBusinessPlatform} from '@shopify/cli-kit/node/session'
import {isUnitTest} from '@shopify/cli-kit/node/context/local'
import {AbortError, BugError} from '@shopify/cli-kit/node/error'
import {fetch, shopifyFetch, Response} from '@shopify/cli-kit/node/http'
import {
  appManagementRequestDoc,
  appManagementAppLogsUrl,
  appManagementHeaders,
  AppManagementRequestOptions,
} from '@shopify/cli-kit/node/api/app-management'
import {appDevRequestDoc, AppDevRequestOptions} from '@shopify/cli-kit/node/api/app-dev'
import {
  businessPlatformOrganizationsRequest,
  businessPlatformOrganizationsRequestDoc,
  BusinessPlatformOrganizationsRequestOptions,
  businessPlatformRequestDoc,
  BusinessPlatformRequestOptions,
} from '@shopify/cli-kit/node/api/business-platform'
import {CLI_KIT_VERSION} from '@shopify/cli-kit/common/version'
import {versionSatisfies} from '@shopify/cli-kit/node/node-package-manager'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {developerDashboardFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {TokenItem} from '@shopify/cli-kit/node/ui'
import {functionsRequestDoc, FunctionsRequestOptions} from '@shopify/cli-kit/node/api/functions'
import {fileExists, readFile} from '@shopify/cli-kit/node/fs'
import {JsonMapType} from '@shopify/cli-kit/node/toml'
import {isPreReleaseVersion} from '@shopify/cli-kit/node/version'
import {UnauthorizedHandler} from '@shopify/cli-kit/node/api/graphql'
import {Variables} from 'graphql-request'
import {webhooksRequestDoc, WebhooksRequestOptions} from '@shopify/cli-kit/node/api/webhooks'

const TEMPLATE_JSON_URL = 'https://cdn.shopify.com/static/cli/extensions/templates.json'

type OrgType = NonNullable<ListAppDevStoresQuery['organization']>
type AccessibleShops = NonNullable<OrgType['accessibleShops']>
type ShopEdge = NonNullable<AccessibleShops['edges'][number]>
type ShopNode = Exclude<ShopEdge['node'], {[key: string]: never}>
export interface GatedExtensionTemplate extends ExtensionTemplate {
  organizationBetaFlags?: string[]
  minimumCliVersion?: string
  deprecatedFromCliVersion?: string
}

export class AppManagementClient implements DeveloperPlatformClient {
  public readonly clientName = ClientName.AppManagement
  public readonly webUiName = 'Developer Dashboard'
  public readonly supportsAtomicDeployments = true
  public readonly supportsDevSessions = true
  public readonly supportsStoreSearch = true
  public readonly organizationSource = OrganizationSource.BusinessPlatform
  public readonly bundleFormat = 'br'
  public readonly supportsDashboardManagedExtensions = false
  private _session: PartnersSession | undefined

  constructor(session?: PartnersSession) {
    this._session = session
  }

  async subscribeToAppLogs(
    input: AppLogsSubscribeMutationVariables,
    _organizationId: string,
  ): Promise<AppLogsSubscribeMutation> {
    return this.appManagementRequest<AppLogsSubscribeMutation, AppLogsSubscribeMutationVariables>({
      query: AppLogsSubscribe,
      variables: {
        shopIds: input.shopIds,
        apiKey: input.apiKey,
      },
    })
  }

  async appLogs(
    options: {
      jwtToken: string
      cursor?: string
      filters?: {
        status?: string
        source?: string
      }
    },
    organizationId: string,
  ): Promise<AppLogsResponse> {
    const response = await fetchAppLogs({
      organizationId,
      jwtToken: options.jwtToken,
      cursor: options.cursor,
      filters: options.filters,
    })

    try {
      const data = (await response.json()) as {
        app_logs?: AppLogData[]
        cursor?: string
        errors?: string[]
      }

      if (!response.ok) {
        return {
          errors: data.errors ?? [`Request failed with status ${response.status}`],
          status: response.status,
        }
      }

      return {
        app_logs: data.app_logs ?? [],
        cursor: data.cursor,
        status: response.status,
      }
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (error) {
      return {
        errors: [`Failed to parse response: ${error}`],
        status: response.status,
      }
    }
  }

  async session(): Promise<PartnersSession> {
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

  async unsafeRefreshToken(): Promise<string> {
    const result = await ensureAuthenticatedAppManagementAndBusinessPlatform({noPrompt: true, forceRefresh: true})
    const session = await this.session()
    session.token = result.appManagementToken
    session.businessPlatformToken = result.businessPlatformToken

    return session.token
  }

  async accountInfo(): Promise<PartnersSession['accountInfo']> {
    return (await this.session()).accountInfo
  }

  async appFromIdentifiers(apiKey: string): Promise<OrganizationApp | undefined> {
    const {app} = await this.activeAppVersionRawResult(apiKey)
    const {name, appModules} = app.activeRelease.version
    const appAccessModule = appModules.find((mod) => mod.specification.externalIdentifier === 'app_access')
    const appHomeModule = appModules.find((mod) => mod.specification.externalIdentifier === 'app_home')
    const apiSecretKeys = app.activeRoot.clientCredentials.secrets.map((secret) => ({secret: secret.key}))
    return {
      id: app.id,
      title: name,
      apiKey: app.key,
      apiSecretKeys,
      organizationId: String(numberFromGid(app.organizationId)),
      grantedScopes: (appAccessModule?.config?.scopes as string[] | undefined) ?? [],
      applicationUrl: appHomeModule?.config?.app_url as string | undefined,
      flags: [],
      developerPlatformClient: this,
    }
  }

  async organizations(): Promise<Organization[]> {
    const organizationsResult = await this.businessPlatformRequest({query: ListOrganizations})
    if (!organizationsResult.currentUserAccount) return []
    return organizationsResult.currentUserAccount.organizationsWithAccessToDestination.nodes.map((org) => ({
      id: idFromEncodedGid(org.id),
      businessName: `${org.name} (Dev Dashboard)`,
      source: this.organizationSource,
    }))
  }

  async orgFromId(orgId: string): Promise<Organization | undefined> {
    const base64Id = encodedGidFromOrganizationIdForBP(orgId)
    const variables = {organizationId: base64Id}
    const organizationResult = await this.businessPlatformRequest({
      query: FindOrganizations,
      variables,
      cacheOptions: {cacheTTL: {hours: 6}},
    })
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
      organizationId,
    }
    const result = await this.appManagementRequest({query, variables})
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
    const variables = {organizationId: gidFromOrganizationIdForShopify(organizationId)}
    const result = await this.appManagementRequest({query, variables})
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

  async templateSpecifications({organizationId}: MinimalAppIdentifiers): Promise<ExtensionTemplatesResult> {
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
    const filteredTemplates = (
      await allowedTemplates(templates, async (betaFlags: string[]) =>
        this.organizationBetaFlags(organizationId, betaFlags),
      )
    ).map((template) => ({...template, sortPriority: counter++}))

    // Extract group order from the original template order (before filtering)
    const groupOrder: string[] = []
    for (const template of templates) {
      if (template.group && !groupOrder.includes(template.group)) {
        groupOrder.push(template.group)
      }
    }
    return {
      templates: filteredTemplates,
      groupOrder,
    }
  }

  async createApp(org: Organization, options: CreateAppOptions): Promise<OrganizationApp> {
    // Query for latest api version
    const apiVersions = await this.apiVersions(org.id)
    const apiVersion =
      apiVersions.publicApiVersions
        .filter((version) => version !== 'unstable')
        .sort()
        .at(-1) ?? 'unstable'

    const variables = createAppVars(options, org.id, apiVersion)

    const mutation = CreateApp
    const result = await this.appManagementRequest({
      query: mutation,
      variables,
    })

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

  async appExtensionRegistrations(
    appIdentifiers: MinimalAppIdentifiers,
    activeAppVersion?: AppVersion,
  ): Promise<AllAppExtensionRegistrationsQuerySchema> {
    const app = activeAppVersion ?? (await this.activeAppVersion(appIdentifiers))

    const configurationRegistrations: ExtensionRegistration[] = []
    const extensionRegistrations: ExtensionRegistration[] = []
    const dashboardManagedExtensionRegistrations: ExtensionRegistration[] = []
    app.appModuleVersions.forEach((mod) => {
      const registration = {
        id: mod.registrationId,
        uuid: mod.registrationUuid!,
        title: mod.registrationTitle,
        type: mod.type,
        activeVersion: mod.config
          ? {
              config: JSON.stringify(mod.config),
              ...(mod.target && {context: mod.target}),
            }
          : undefined,
      }
      if (CONFIG_EXTENSION_IDS.includes(registration.id)) {
        configurationRegistrations.push(registration)
      } else if (mod.specification?.options?.managementExperience === 'dashboard') {
        dashboardManagedExtensionRegistrations.push(registration)
      } else {
        extensionRegistrations.push(registration)
      }
    })
    return {
      app: {
        dashboardManagedExtensionRegistrations,
        configurationRegistrations,
        extensionRegistrations,
      },
    }
  }

  async appVersions({id, organizationId, title}: MinimalOrganizationApp): Promise<AppVersionsQuerySchemaInterface> {
    const query = AppVersions
    const variables = {appId: id}
    const result = await this.appManagementRequest({query, variables})
    return {
      app: {
        id: result.app.id,
        organizationId,
        title,
        appVersions: {
          nodes:
            result.app.versions?.edges.map((edge) => {
              const version = edge.node
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
            }) ?? [],
          pageInfo: {
            totalResults: result.app.versionsCount,
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
    const result = await this.appManagementRequest({query, variables})
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
      this.activeAppVersionRawResult(app.apiKey),
      this.appManagementRequest({query: AppVersionById, variables}),
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
    const result = await this.activeAppVersionRawResult(app.apiKey)
    return {
      appModuleVersions: result.app.activeRelease.version.appModules.map(appModuleVersion),
      ...result.app.activeRelease,
    }
  }

  async generateSignedUploadUrl({organizationId}: MinimalAppIdentifiers): Promise<AssetUrlSchema> {
    const variables = {
      sourceExtension: 'BR' as SourceExtension,
      organizationId: gidFromOrganizationIdForShopify(organizationId),
    }
    const result = await this.appManagementRequest({
      query: CreateAssetUrl,
      variables,
      cacheOptions: {cacheTTL: {minutes: 59}},
    })
    return {
      assetUrl: result.appRequestSourceUploadUrl.sourceUploadUrl,
      userErrors: result.appRequestSourceUploadUrl.userErrors,
    }
  }

  async updateExtension(_extensionInput: ExtensionUpdateDraftMutationVariables): Promise<ExtensionUpdateDraftMutation> {
    throw new BugError('Not implemented: updateExtension')
  }

  async deploy({
    appManifest,
    appId,
    organizationId,
    versionTag,
    message,
    commitReference,
    bundleUrl,
    skipPublish: noRelease,
  }: AppDeployOptions): Promise<AppDeploySchema> {
    const metadata = {versionTag, message, sourceControlUrl: commitReference}
    const queryVersion: CreateAppVersionMutationVariables['version'] = bundleUrl
      ? {sourceUrl: bundleUrl}
      : {source: appManifest}

    const variables: CreateAppVersionMutationVariables = {appId, version: queryVersion, metadata}

    const result = await this.appManagementRequest({
      query: CreateAppVersion,
      variables,
      requestOptions: {requestMode: 'slow-request'},
    })
    const {version} = result.appVersionCreate
    const userErrors = result.appVersionCreate.userErrors.map(toUserError) ?? []
    if (!version) return {appDeploy: {userErrors}}

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
        userErrors,
      },
    }
    if (noRelease) return versionResult

    const releaseVariables = {appId, versionId: version.id}
    const releaseResult = await this.appManagementRequest({
      query: ReleaseVersion,
      variables: releaseVariables,
    })
    if (releaseResult.appReleaseCreate.userErrors) {
      versionResult.appDeploy.userErrors = (versionResult.appDeploy.userErrors ?? []).concat(
        releaseResult.appReleaseCreate.userErrors.map(toUserError),
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
    const releaseResult = await this.appManagementRequest({
      query: ReleaseVersion,
      variables: releaseVariables,
    })

    if (releaseResult.appReleaseCreate.release) {
      return {
        appRelease: {
          appVersion: {
            versionTag: releaseResult.appReleaseCreate.release.version.metadata.versionTag,
            message: releaseResult.appReleaseCreate.release.version.metadata.message,
            location: [
              await appDeepLink({organizationId, id: appId}),
              'versions',
              numberFromGid(releaseResult.appReleaseCreate.release.version.id).toString(),
            ].join('/'),
          },
        },
      }
    } else {
      return {
        appRelease: {
          userErrors:
            releaseResult.appReleaseCreate.userErrors?.map((err) => ({
              field: err.field,
              message: err.message,
              category: err.category,
              details: [],
              on: err.on,
            })) ?? [],
        },
      }
    }
  }

  async storeByDomain(orgId: string, shopDomain: string): Promise<OrganizationStore | undefined> {
    const queryVariables: FetchDevStoreByDomainQueryVariables = {domain: shopDomain}
    const storesResult = await this.businessPlatformOrganizationsRequest({
      query: FetchDevStoreByDomain,
      organizationId: String(numberFromGid(orgId)),
      variables: queryVariables,
    })

    const organization = storesResult.organization

    if (!organization) {
      throw new AbortError(`No organization found`)
    }

    const bpStoresArray = organization.accessibleShops?.edges.map((value) => value.node) ?? []
    const provisionable = isStoreProvisionable(organization.currentUser?.organizationPermissions ?? [])
    const storesArray = mapBusinessPlatformStoresToOrganizationStores(bpStoresArray, provisionable)
    return storesArray[0]
  }

  async ensureUserAccessToStore(orgId: string, store: OrganizationStore): Promise<void> {
    if (!store.provisionable) {
      return
    }
    const encodedShopId = encodedGidFromShopId(store.shopId)
    const variables: ProvisionShopAccessMutationVariables = {
      input: {shopifyShopId: encodedShopId},
    }

    const fullResult = await businessPlatformOrganizationsRequestDoc({
      query: ProvisionShopAccess,
      token: await this.businessPlatformToken(),
      organizationId: String(numberFromGid(orgId)),
      variables,
      unauthorizedHandler: this.createUnauthorizedHandler(),
    })
    const provisionResult = fullResult.organizationUserProvisionShopAccess
    if (!provisionResult.success) {
      const errorMessages = provisionResult.userErrors?.map((error) => error.message).join(', ') ?? ''
      throw new BugError(`Failed to provision user access to store: ${errorMessages}`)
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
    const result = await this.webhooksRequest({organizationId, query, variables})
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
    const result = await this.webhooksRequest({organizationId, query: PublicApiVersions, variables: {}})
    return {publicApiVersions: result.publicApiVersions.map((version) => version.handle)}
  }

  async topics(
    {api_version: apiVersion}: WebhookTopicsVariables,
    organizationId: string,
  ): Promise<WebhookTopicsSchema> {
    const query = AvailableTopics
    const variables = {apiVersion}
    const result = await this.webhooksRequest({organizationId, query, variables})

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
      const {app} = await this.activeAppVersionRawResult(apiKey)
      const appIdNumber = String(numberFromGid(app.id))
      const result = await this.functionsRequest({
        organizationId,
        query: SchemaDefinitionByTarget,
        appId: appIdNumber,
        variables: {
          handle: input.handle,
          version: input.version,
        },
      })

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
      const {app} = await this.activeAppVersionRawResult(apiKey)
      const appIdNumber = String(numberFromGid(app.id))
      const result = await this.functionsRequest({
        organizationId,
        query: SchemaDefinitionByApiType,
        appId: appIdNumber,
        variables: input,
      })

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

  async devSessionCreate({appId, assetsUrl, shopFqdn}: DevSessionCreateOptions): Promise<DevSessionCreateMutation> {
    const appIdNumber = String(numberFromGid(appId))
    return this.appDevRequest({
      query: DevSessionCreate,
      shopFqdn,
      variables: {appId: appIdNumber, assetsUrl: assetsUrl ?? ''},
    })
  }

  async devSessionUpdate({
    appId,
    assetsUrl,
    shopFqdn,
    manifest,
    inheritedModuleUids,
  }: DevSessionUpdateOptions): Promise<DevSessionUpdateMutation> {
    const appIdNumber = String(numberFromGid(appId))
    const variables: DevSessionUpdateMutationVariables = {
      appId: appIdNumber,
      assetsUrl,
      manifest: JSON.stringify(manifest),
      inheritedModuleUids,
    }
    return this.appDevRequest({query: DevSessionUpdate, shopFqdn, variables})
  }

  async devSessionDelete({appId, shopFqdn}: DevSessionDeleteOptions): Promise<DevSessionDeleteMutation> {
    const appIdNumber = String(numberFromGid(appId))
    return this.appDevRequest({query: DevSessionDelete, shopFqdn, variables: {appId: appIdNumber}})
  }

  async getCreateDevStoreLink(org: Organization): Promise<TokenItem> {
    const url = `https://${await developerDashboardFqdn()}/dashboard/${org.id}/stores`
    return [
      `Looks like you don't have any dev stores associated with ${org.businessName}'s Dev Dashboard.`,
      {link: {url, label: 'Create one now'}},
    ]
  }

  private async activeAppVersionRawResult(apiKey: string): Promise<ActiveAppReleaseQuery> {
    return this.appManagementRequest({query: ActiveAppReleaseFromApiKey, variables: {apiKey}})
  }

  private async organizationBetaFlags(
    organizationId: string,
    allBetaFlags: string[],
  ): Promise<{[flag: (typeof allBetaFlags)[number]]: boolean}> {
    const variables: OrganizationBetaFlagsQueryVariables = {
      organizationId: encodedGidFromOrganizationIdForBP(organizationId),
    }
    const flagsResult = await businessPlatformOrganizationsRequest<OrganizationBetaFlagsQuerySchema>({
      query: organizationBetaFlagsQuery(allBetaFlags),
      token: await this.businessPlatformToken(),
      organizationId,
      variables,
      unauthorizedHandler: this.createUnauthorizedHandler(),
    })
    const result: {[flag: (typeof allBetaFlags)[number]]: boolean} = {}
    allBetaFlags.forEach((flag) => {
      result[flag] = Boolean(flagsResult.organization[`flag_${flag}`])
    })
    return result
  }

  private async appManagementRequest<TResult, TVariables extends Variables>(
    options: Omit<AppManagementRequestOptions<TResult, TVariables>, 'unauthorizedHandler' | 'token'>,
  ): Promise<TResult> {
    return appManagementRequestDoc({
      ...options,
      token: await this.token(),
      unauthorizedHandler: this.createUnauthorizedHandler(),
    })
  }

  private async appDevRequest<TResult, TVariables extends Variables>(
    options: Omit<AppDevRequestOptions<TResult, TVariables>, 'unauthorizedHandler' | 'token'>,
  ): Promise<TResult> {
    return appDevRequestDoc({
      ...options,
      token: await this.token(),
      unauthorizedHandler: this.createUnauthorizedHandler(),
    })
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

  private async functionsRequest<TResult, TVariables extends Variables>(
    options: Omit<FunctionsRequestOptions<TResult, TVariables>, 'unauthorizedHandler' | 'token'>,
  ): Promise<TResult> {
    return functionsRequestDoc<TResult, TVariables>({
      ...options,
      token: await this.token(),
      unauthorizedHandler: this.createUnauthorizedHandler(),
    })
  }

  private async webhooksRequest<TResult, TVariables extends Variables>(
    options: Omit<WebhooksRequestOptions<TResult, TVariables>, 'unauthorizedHandler' | 'token'>,
  ): Promise<TResult> {
    return webhooksRequestDoc<TResult, TVariables>({
      ...options,
      token: await this.token(),
      unauthorizedHandler: this.createUnauthorizedHandler(),
    })
  }

  private createUnauthorizedHandler(): UnauthorizedHandler {
    return createUnauthorizedHandler(this)
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

// this is a temporary solution for editions to support https://vault.shopify.io/gsd/projects/31406
// read more here: https://vault.shopify.io/gsd/projects/31406
const MAGIC_URL = 'https://shopify.dev/apps/default-app-home'
const MAGIC_REDIRECT_URL = 'https://shopify.dev/apps/default-app-home/api/auth'

function createAppVars(
  options: CreateAppOptions,
  organizationId: string,
  apiVersion: string,
): CreateAppMutationVariables {
  const {isLaunchable, scopesArray, name} = options
  const source: AppVersionSource = {
    source: {
      name,
      modules: [
        {
          type: AppHomeSpecIdentifier,
          config: {
            app_url: isLaunchable ? 'https://example.com' : MAGIC_URL,
            // Ext-only apps should be embedded = false, however we are hardcoding this to
            // match Partners behaviour for now
            // https://github.com/Shopify/develop-app-inner-loop/issues/2789
            embedded: true,
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

  return {
    initialVersion: {source: source.source as unknown as JsonMapType},
    organizationId: gidFromOrganizationIdForShopify(organizationId),
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

// App Managament uses a different GID format than Business Platform for organizationId.
function gidFromOrganizationIdForShopify(id: string): string {
  const num = id.startsWith('gid://') ? numberFromGid(id) : Number(id)
  return `gid://shopify/Organization/${num}`
}

// 1234 => gid://organization/ShopifyShop/1234 => base64
export function encodedGidFromShopId(id: string): string {
  const gid = `gid://organization/ShopifyShop/${id}`
  return Buffer.from(gid).toString('base64')
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

async function appDeepLink({
  id,
  organizationId,
}: Pick<MinimalAppIdentifiers, 'id' | 'organizationId'>): Promise<string> {
  const orgId = numberFromGid(organizationId).toString()
  return `https://${await developerDashboardFqdn()}/dashboard/${orgId}/apps/${numberFromGid(id)}`
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
  version: string = CLI_KIT_VERSION,
): Promise<GatedExtensionTemplate[]> {
  const allBetaFlags = Array.from(new Set(templates.map((ext) => ext.organizationBetaFlags ?? []).flat()))
  const enabledBetaFlags = await betaFlagsFetcher(allBetaFlags)
  return templates.filter((ext) => {
    const hasAnyNeededBetas =
      !ext.organizationBetaFlags || ext.organizationBetaFlags.every((flag) => enabledBetaFlags[flag])
    const satisfiesMinCliVersion = !ext.minimumCliVersion || versionSatisfies(version, `>=${ext.minimumCliVersion}`)
    const satisfiesDeprecatedFromCliVersion =
      !ext.deprecatedFromCliVersion || versionSatisfies(version, `<${ext.deprecatedFromCliVersion}`)
    const satisfiesVersion = satisfiesMinCliVersion && satisfiesDeprecatedFromCliVersion
    const satisfiesPreReleaseVersion = isPreReleaseVersion(version) && ext.deprecatedFromCliVersion === undefined
    return hasAnyNeededBetas && (satisfiesVersion || satisfiesPreReleaseVersion)
  })
}

function experience(identifier: string): 'configuration' | 'extension' {
  return CONFIG_EXTENSION_IDS.includes(identifier) ? 'configuration' : 'extension'
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

function appModuleVersion(mod: ReleasedAppModuleFragment): Required<AppModuleVersion> {
  return {
    registrationId: mod.userIdentifier === mod.uuid ? '' : mod.userIdentifier,
    registrationUuid: mod.uuid,
    registrationTitle: mod.handle,
    type: mod.specification.externalIdentifier,
    config: mod.config,
    target: mod.target ?? '',
    specification: {
      ...mod.specification,
      identifier: mod.specification.identifier,
      options: {managementExperience: mod.specification.managementExperience as 'cli' | 'custom' | 'dashboard'},
      experience: experience(mod.specification.identifier),
    },
  }
}

const fetchAppLogs = async ({
  organizationId,
  jwtToken,
  cursor,
  filters,
}: FetchAppLogsDevDashboardOptions): Promise<Response> => {
  const url = await appManagementAppLogsUrl(organizationId, cursor, filters)
  const headers = appManagementHeaders(jwtToken)

  return shopifyFetch(url, {
    method: 'GET',
    headers,
  })
}

interface FetchAppLogsDevDashboardOptions {
  organizationId: string
  jwtToken: string
  cursor?: string
  filters?: {
    status?: string
    source?: string
  }
}

function toUserError(err: CreateAppVersionMutation['appVersionCreate']['userErrors'][number]): UserError {
  const details = []
  const extensionId = (err.on[0] as {user_identifier: string})?.user_identifier
  if (extensionId) {
    details.push({extension_id: extensionId})
  }
  return {...err, details}
}

function isStoreProvisionable(permissions: string[]) {
  return permissions.includes('ondemand_access_to_stores')
}
