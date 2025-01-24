import {AppManagementClient} from './developer-platform-client/app-management-client.js'
import {PartnersSession} from '../../cli/services/context/partner-account-info.js'
import {
  MinimalAppIdentifiers,
  AppApiKeyAndOrgId,
  MinimalOrganizationApp,
  Organization,
  OrganizationApp,
  OrganizationStore,
} from '../models/organization.js'
import {AllAppExtensionRegistrationsQuerySchema} from '../api/graphql/all_app_extension_registrations.js'
import {AppDeploySchema, AppDeployVariables} from '../api/graphql/app_deploy.js'

import {FindStoreByDomainSchema} from '../api/graphql/find_store_by_domain.js'
import {AppVersionsQuerySchema} from '../api/graphql/get_versions_list.js'

import {AppReleaseSchema} from '../api/graphql/app_release.js'
import {AppVersionsDiffSchema} from '../api/graphql/app_versions_diff.js'
import {SendSampleWebhookSchema, SendSampleWebhookVariables} from '../services/webhook/request-sample.js'
import {PublicApiVersionsSchema} from '../services/webhook/request-api-versions.js'
import {WebhookTopicsSchema, WebhookTopicsVariables} from '../services/webhook/request-topics.js'
import {
  MigrateFlowExtensionSchema,
  MigrateFlowExtensionVariables,
} from '../api/graphql/extension_migrate_flow_extension.js'
import {ExtensionTemplate} from '../models/app/template.js'
import {SchemaDefinitionByTargetQueryVariables} from '../api/graphql/functions/generated/schema-definition-by-target.js'
import {SchemaDefinitionByApiTypeQueryVariables} from '../api/graphql/functions/generated/schema-definition-by-api-type.js'
import {
  MigrateToUiExtensionSchema,
  MigrateToUiExtensionVariables,
} from '../api/graphql/extension_migrate_to_ui_extension.js'
import {AppLogsSubscribeVariables, AppLogsSubscribeResponse} from '../api/graphql/subscribe_to_app_logs.js'
import {RemoteSpecification} from '../api/graphql/extension_specifications.js'
import {MigrateAppModuleSchema, MigrateAppModuleVariables} from '../api/graphql/extension_migrate_app_module.js'
import {AppConfiguration, isCurrentAppSchema} from '../models/app/app.js'
import {loadAppConfiguration} from '../models/app/loader.js'

import {DevSessionCreateMutation} from '../api/graphql/app-dev/generated/dev-session-create.js'
import {DevSessionUpdateMutation} from '../api/graphql/app-dev/generated/dev-session-update.js'
import {DevSessionDeleteMutation} from '../api/graphql/app-dev/generated/dev-session-delete.js'
import {isAppManagementDisabled} from '@shopify/cli-kit/node/context/local'

export enum ClientName {
  AppManagement = 'app-management',
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
  if (isAppManagementDisabled()) {
    throw new Error('not implemented')
  } else {
    return [new AppManagementClient()]
  }
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
  } catch (error) {
    // If the app is invalid, we really don't care at this point. This function is purely responsible for selecting
    // a client.
    throw new Error('not implemented')
  }
}

export function selectDeveloperPlatformClient({
  configuration,
  organization,
}: SelectDeveloperPlatformClientOptions = {}): DeveloperPlatformClient {
  if (organization) return new AppManagementClient()
  return selectDeveloperPlatformClientByConfig(configuration)
}

function selectDeveloperPlatformClientByConfig(configuration: AppConfiguration | undefined): DeveloperPlatformClient {
  if (!configuration || (isCurrentAppSchema(configuration) && configuration.organization_id))
    return new AppManagementClient()
  throw new Error('not implemented')
}

export interface CreateAppOptions {
  name: string
  isLaunchable?: boolean
  scopesArray?: string[]
  directory?: string
  isEmbedded?: boolean
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
  readonly webUiName: 'Developer Dashboard'
  session: () => Promise<PartnersSession>
  refreshToken: () => Promise<string>
  accountInfo: () => Promise<PartnersSession['accountInfo']>
  appFromIdentifiers: (app: AppApiKeyAndOrgId) => Promise<OrganizationApp | undefined>
  organizations: () => Promise<Organization[]>
  orgFromId: (orgId: string) => Promise<Organization | undefined>
  orgAndApps: (orgId: string) => Promise<Paginateable<{organization: Organization; apps: MinimalOrganizationApp[]}>>
  appsForOrg: (orgId: string, term?: string) => Promise<Paginateable<{apps: MinimalOrganizationApp[]}>>
  specifications: (app: MinimalAppIdentifiers) => Promise<RemoteSpecification[]>
  templateSpecifications: (app: MinimalAppIdentifiers) => Promise<ExtensionTemplate[]>
  createApp: (org: Organization, options: CreateAppOptions) => Promise<OrganizationApp>
  devStoresForOrg: (orgId: string, searchTerm?: string) => Promise<Paginateable<{stores: OrganizationStore[]}>>
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
  deploy: (input: AppDeployOptions) => Promise<AppDeploySchema>
  release: (input: {app: MinimalOrganizationApp; version: AppVersionIdentifiers}) => Promise<AppReleaseSchema>
  sendSampleWebhook: (input: SendSampleWebhookVariables, organizationId: string) => Promise<SendSampleWebhookSchema>
  apiVersions: (organizationId: string) => Promise<PublicApiVersionsSchema>
  topics: (input: WebhookTopicsVariables, organizationId: string) => Promise<WebhookTopicsSchema>
  migrateFlowExtension: (input: MigrateFlowExtensionVariables) => Promise<MigrateFlowExtensionSchema>
  migrateAppModule: (input: MigrateAppModuleVariables) => Promise<MigrateAppModuleSchema>
  targetSchemaDefinition: (
    input: SchemaDefinitionByTargetQueryVariables,
    apiKey: string,
    organizationId: string,
  ) => Promise<string | null>
  apiSchemaDefinition: (
    input: SchemaDefinitionByApiTypeQueryVariables,
    apiKey: string,
    organizationId: string,
  ) => Promise<string | null>
  migrateToUiExtension: (input: MigrateToUiExtensionVariables) => Promise<MigrateToUiExtensionSchema>
  toExtensionGraphQLType: (input: string) => string
  subscribeToAppLogs: (input: AppLogsSubscribeVariables) => Promise<AppLogsSubscribeResponse>
  appDeepLink: (app: MinimalAppIdentifiers) => Promise<string>
  devSessionCreate: (input: DevSessionOptions) => Promise<DevSessionCreateMutation>
  devSessionUpdate: (input: DevSessionOptions) => Promise<DevSessionUpdateMutation>
  devSessionDelete: (input: Omit<DevSessionOptions, 'assetsUrl'>) => Promise<DevSessionDeleteMutation>
  getCreateDevStoreLink: (input: string) => Promise<string>
}
