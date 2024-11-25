import {PartnersClient} from './developer-platform-client/partners-client.js'
import {AppManagementClient} from './developer-platform-client/app-management-client.js'
import {PartnersSession} from '../../cli/services/context/partner-account-info.js'
import {
  MinimalAppIdentifiers,
  MinimalOrganizationApp,
  Organization,
  OrganizationApp,
  OrganizationSource,
  OrganizationStore,
} from '../models/organization.js'
import {AllAppExtensionRegistrationsQuerySchema} from '../api/graphql/all_app_extension_registrations.js'
import {AppDeploySchema, AppDeployVariables} from '../api/graphql/app_deploy.js'

import {ExtensionCreateSchema, ExtensionCreateVariables} from '../api/graphql/extension_create.js'
import {
  ConvertDevToTransferDisabledSchema,
  ConvertDevToTransferDisabledStoreVariables,
} from '../api/graphql/convert_dev_to_transfer_disabled_store.js'
import {FindStoreByDomainSchema} from '../api/graphql/find_store_by_domain.js'
import {AppVersionsQuerySchema} from '../api/graphql/get_versions_list.js'
import {
  DevelopmentStorePreviewUpdateInput,
  DevelopmentStorePreviewUpdateSchema,
} from '../api/graphql/development_preview.js'
import {FindAppPreviewModeSchema, FindAppPreviewModeVariables} from '../api/graphql/find_app_preview_mode.js'
import {AppReleaseSchema} from '../api/graphql/app_release.js'
import {AppVersionsDiffSchema} from '../api/graphql/app_versions_diff.js'
import {SendSampleWebhookSchema, SendSampleWebhookVariables} from '../services/webhook/request-sample.js'
import {PublicApiVersionsSchema} from '../services/webhook/request-api-versions.js'
import {WebhookTopicsSchema, WebhookTopicsVariables} from '../services/webhook/request-topics.js'
import {
  MigrateFlowExtensionSchema,
  MigrateFlowExtensionVariables,
} from '../api/graphql/extension_migrate_flow_extension.js'
import {UpdateURLsSchema, UpdateURLsVariables} from '../api/graphql/update_urls.js'
import {CurrentAccountInfoSchema} from '../api/graphql/current_account_info.js'
import {ExtensionTemplate} from '../models/app/template.js'
import {TargetSchemaDefinitionQueryVariables} from '../api/graphql/functions/target_schema_definition.js'
import {ApiSchemaDefinitionQueryVariables} from '../api/graphql/functions/api_schema_definition.js'
import {
  MigrateToUiExtensionSchema,
  MigrateToUiExtensionVariables,
} from '../api/graphql/extension_migrate_to_ui_extension.js'
import {AppLogsSubscribeVariables, AppLogsSubscribeResponse} from '../api/graphql/subscribe_to_app_logs.js'
import {RemoteSpecification} from '../api/graphql/extension_specifications.js'
import {MigrateAppModuleSchema, MigrateAppModuleVariables} from '../api/graphql/extension_migrate_app_module.js'
import {AppConfiguration, isCurrentAppSchema} from '../models/app/app.js'
import {loadAppConfiguration} from '../models/app/loader.js'
import {
  ExtensionUpdateDraftMutation,
  ExtensionUpdateDraftMutationVariables,
} from '../api/graphql/partners/generated/update-draft.js'
import {DevSessionCreateMutation} from '../api/graphql/app-dev/generated/dev-session-create.js'
import {DevSessionUpdateMutation} from '../api/graphql/app-dev/generated/dev-session-update.js'
import {DevSessionDeleteMutation} from '../api/graphql/app-dev/generated/dev-session-delete.js'
import {isTruthy} from '@shopify/cli-kit/node/context/utilities'

export enum ClientName {
  AppManagement = 'app-management',
  Partners = 'partners',
}

export type Paginateable<T> = T & {
  hasMorePages: boolean
}

interface SelectDeveloperPlatformClientOptions {
  configuration?: AppConfiguration | undefined
  organization?: Organization
}

export interface AppVersionIdentifiers {
  appVersionId: number
  versionId: string
}

export function allDeveloperPlatformClients(): DeveloperPlatformClient[] {
  const clients: DeveloperPlatformClient[] = [new PartnersClient()]
  if (isTruthy(process.env.USE_APP_MANAGEMENT_API)) clients.unshift(new AppManagementClient())
  return clients
}

/**
 * Attempts to load an app's configuration in order to select a developer platform client.
 *
 * The provided options are a subset of what is common across most services.
 *
 * @param directory - The working directory for this command (possibly via `--path`)
 * @param configName - An optional configuration file name to force, provided by the developer
 * @param developerPlatformClient - An optional developer platform client to use, forced by the developer
 */
export async function sniffServiceOptionsAndAppConfigToSelectPlatformClient(options: {
  directory: string
  configName?: string
  developerPlatformClient?: DeveloperPlatformClient
}): Promise<DeveloperPlatformClient> {
  if (options.developerPlatformClient) {
    return options.developerPlatformClient
  }
  try {
    const {configuration} = await loadAppConfiguration({
      ...options,
      userProvidedConfigName: options.configName,
    })
    const developerPlatformClient = selectDeveloperPlatformClient({configuration})
    return developerPlatformClient
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    // If the app is invalid, we really don't care at this point. This function is purely responsible for selecting
    // a client.
    return new PartnersClient()
  }
}

export function selectDeveloperPlatformClient({
  configuration,
  organization,
}: SelectDeveloperPlatformClientOptions = {}): DeveloperPlatformClient {
  if (isTruthy(process.env.USE_APP_MANAGEMENT_API)) {
    if (organization) return selectDeveloperPlatformClientByOrg(organization)
    return selectDeveloperPlatformClientByConfig(configuration)
  }
  return new PartnersClient()
}

function selectDeveloperPlatformClientByOrg(organization: Organization): DeveloperPlatformClient {
  if (organization.source === OrganizationSource.BusinessPlatform) return new AppManagementClient()
  return new PartnersClient()
}

function selectDeveloperPlatformClientByConfig(configuration: AppConfiguration | undefined): DeveloperPlatformClient {
  if (!configuration || (isCurrentAppSchema(configuration) && configuration.organization_id))
    return new AppManagementClient()
  return new PartnersClient()
}

export interface CreateAppOptions {
  isLaunchable?: boolean
  scopesArray?: string[]
  directory?: string
}

interface AppModuleVersionSpecification {
  identifier: string
  name: string
  experience: 'extension' | 'configuration' | 'deprecated'
  options: {
    managementExperience: 'cli' | 'custom' | 'dashboard'
  }
}

export interface AppModuleVersion {
  registrationId: string
  registrationUuid?: string
  registrationTitle: string
  config?: object
  type: string
  specification?: AppModuleVersionSpecification
}

export interface AppVersion {
  appModuleVersions: AppModuleVersion[]
}

export type AppVersionWithContext = AppVersion & {
  id: number
  uuid: string
  versionTag?: string | null
  location: string
  message: string
}

export type AppDeployOptions = AppDeployVariables & {
  appId: string
  organizationId: string
  name: string
}

export interface DevSessionOptions {
  shopFqdn: string
  appId: string
  assetsUrl: string
}

type WithUserErrors<T> = T & {
  userErrors: {
    field?: string[] | null
    message: string
  }[]
}

export type AssetUrlSchema = WithUserErrors<{
  assetUrl?: string | null
}>

export enum Flag {}

const FlagMap: {[key: string]: Flag} = {}

export function filterDisabledFlags(disabledFlags: string[] = []): Flag[] {
  const defaultActiveFlags: Flag[] = []
  const remoteDisabledFlags = disabledFlags.map((flag) => FlagMap[flag])
  return defaultActiveFlags.filter((flag) => !remoteDisabledFlags.includes(flag))
}

export interface DeveloperPlatformClient {
  readonly clientName: string
  readonly webUiName: string
  readonly supportsAtomicDeployments: boolean
  readonly requiresOrganization: boolean
  readonly supportsDevSessions: boolean
  session: () => Promise<PartnersSession>
  refreshToken: () => Promise<string>
  accountInfo: () => Promise<PartnersSession['accountInfo']>
  appFromId: (app: MinimalAppIdentifiers) => Promise<OrganizationApp | undefined>
  organizations: () => Promise<Organization[]>
  orgFromId: (orgId: string) => Promise<Organization | undefined>
  orgAndApps: (orgId: string) => Promise<Paginateable<{organization: Organization; apps: MinimalOrganizationApp[]}>>
  appsForOrg: (orgId: string, term?: string) => Promise<Paginateable<{apps: MinimalOrganizationApp[]}>>
  specifications: (app: MinimalAppIdentifiers) => Promise<RemoteSpecification[]>
  templateSpecifications: (app: MinimalAppIdentifiers) => Promise<ExtensionTemplate[]>
  createApp: (org: Organization, name: string, options?: CreateAppOptions) => Promise<OrganizationApp>
  devStoresForOrg: (orgId: string) => Promise<OrganizationStore[]>
  storeByDomain: (orgId: string, shopDomain: string) => Promise<FindStoreByDomainSchema>
  appExtensionRegistrations: (
    app: MinimalAppIdentifiers,
    activeAppVersion?: AppVersion,
  ) => Promise<AllAppExtensionRegistrationsQuerySchema>
  appVersions: (app: OrganizationApp) => Promise<AppVersionsQuerySchema>
  activeAppVersion: (app: MinimalAppIdentifiers) => Promise<AppVersion | undefined>
  appVersionByTag: (app: MinimalOrganizationApp, tag: string) => Promise<AppVersionWithContext>
  appVersionsDiff: (app: MinimalOrganizationApp, version: AppVersionIdentifiers) => Promise<AppVersionsDiffSchema>
  generateSignedUploadUrl: (app: MinimalAppIdentifiers) => Promise<AssetUrlSchema>
  createExtension: (input: ExtensionCreateVariables) => Promise<ExtensionCreateSchema>
  updateExtension: (input: ExtensionUpdateDraftMutationVariables) => Promise<ExtensionUpdateDraftMutation>
  deploy: (input: AppDeployOptions) => Promise<AppDeploySchema>
  release: (input: {app: MinimalOrganizationApp; version: AppVersionIdentifiers}) => Promise<AppReleaseSchema>
  convertToTransferDisabledStore: (
    input: ConvertDevToTransferDisabledStoreVariables,
  ) => Promise<ConvertDevToTransferDisabledSchema>
  updateDeveloperPreview: (input: DevelopmentStorePreviewUpdateInput) => Promise<DevelopmentStorePreviewUpdateSchema>
  appPreviewMode: (input: FindAppPreviewModeVariables) => Promise<FindAppPreviewModeSchema>
  sendSampleWebhook: (input: SendSampleWebhookVariables) => Promise<SendSampleWebhookSchema>
  apiVersions: () => Promise<PublicApiVersionsSchema>
  topics: (input: WebhookTopicsVariables) => Promise<WebhookTopicsSchema>
  migrateFlowExtension: (input: MigrateFlowExtensionVariables) => Promise<MigrateFlowExtensionSchema>
  migrateAppModule: (input: MigrateAppModuleVariables) => Promise<MigrateAppModuleSchema>
  updateURLs: (input: UpdateURLsVariables) => Promise<UpdateURLsSchema>
  currentAccountInfo: () => Promise<CurrentAccountInfoSchema>
  targetSchemaDefinition: (input: TargetSchemaDefinitionQueryVariables) => Promise<string | null>
  apiSchemaDefinition: (input: ApiSchemaDefinitionQueryVariables) => Promise<string | null>
  migrateToUiExtension: (input: MigrateToUiExtensionVariables) => Promise<MigrateToUiExtensionSchema>
  toExtensionGraphQLType: (input: string) => string
  subscribeToAppLogs: (input: AppLogsSubscribeVariables) => Promise<AppLogsSubscribeResponse>
  appDeepLink: (app: MinimalAppIdentifiers) => Promise<string>
  devSessionCreate: (input: DevSessionOptions) => Promise<DevSessionCreateMutation>
  devSessionUpdate: (input: DevSessionOptions) => Promise<DevSessionUpdateMutation>
  devSessionDelete: (input: Omit<DevSessionOptions, 'assetsUrl'>) => Promise<DevSessionDeleteMutation>
  getCreateDevStoreLink: (input: string) => Promise<string>
}
