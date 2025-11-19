import {PartnersClient} from './developer-platform-client/partners-client.js'
import {AppManagementClient} from './developer-platform-client/app-management-client.js'
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
import {ExtensionTemplatesResult} from '../models/app/template.js'
import {SchemaDefinitionByTargetQueryVariables} from '../api/graphql/functions/generated/schema-definition-by-target.js'
import {SchemaDefinitionByApiTypeQueryVariables} from '../api/graphql/functions/generated/schema-definition-by-api-type.js'
import {
  MigrateToUiExtensionSchema,
  MigrateToUiExtensionVariables,
} from '../api/graphql/extension_migrate_to_ui_extension.js'
import {RemoteSpecification} from '../api/graphql/extension_specifications.js'
import {MigrateAppModuleSchema, MigrateAppModuleVariables} from '../api/graphql/extension_migrate_app_module.js'
import {AppManifest} from '../models/app/app.js'
import {
  ExtensionUpdateDraftMutation,
  ExtensionUpdateDraftMutationVariables,
} from '../api/graphql/partners/generated/update-draft.js'
import {DevSessionCreateMutation} from '../api/graphql/app-dev/generated/dev-session-create.js'
import {DevSessionUpdateMutation} from '../api/graphql/app-dev/generated/dev-session-update.js'
import {DevSessionDeleteMutation} from '../api/graphql/app-dev/generated/dev-session-delete.js'
import {AppLogsOptions} from '../services/app-logs/utils.js'
import {AppLogData} from '../services/app-logs/types.js'
import {
  AppLogsSubscribeMutation,
  AppLogsSubscribeMutationVariables,
} from '../api/graphql/app-management/generated/app-logs-subscribe.js'
import {Session} from '@shopify/cli-kit/node/session'
import {TokenItem} from '@shopify/cli-kit/node/ui'
import {blockPartnersAccess} from '@shopify/cli-kit/node/environment'
import {UnauthorizedHandler} from '@shopify/cli-kit/node/api/graphql'
import {JsonMapType} from '@shopify/cli-kit/node/toml'

export enum ClientName {
  AppManagement = 'app-management',
  Partners = 'partners',
}

export type Paginateable<T> = T & {
  hasMorePages: boolean
}

interface SelectDeveloperPlatformClientOptions {
  organization?: Organization
}

export interface AppVersionIdentifiers {
  appVersionId: number
  versionId: string
}

export function allDeveloperPlatformClients(): DeveloperPlatformClient[] {
  const clients: DeveloperPlatformClient[] = []

  clients.push(AppManagementClient.getInstance())

  if (!blockPartnersAccess()) {
    clients.push(PartnersClient.getInstance())
  }

  return clients
}

export function selectDeveloperPlatformClient({
  organization,
}: SelectDeveloperPlatformClientOptions = {}): DeveloperPlatformClient {
  if (organization) return selectDeveloperPlatformClientByOrg(organization)
  return defaultDeveloperPlatformClient()
}

function selectDeveloperPlatformClientByOrg(organization: Organization): DeveloperPlatformClient {
  if (organization.source === OrganizationSource.BusinessPlatform) return AppManagementClient.getInstance()
  return PartnersClient.getInstance()
}

function defaultDeveloperPlatformClient(): DeveloperPlatformClient {
  if (blockPartnersAccess()) return AppManagementClient.getInstance()

  return PartnersClient.getInstance()
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
  target?: string
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
  appManifest: AppManifest
  appId: string
  organizationId: string
  name: string
}

interface DevSessionSharedOptions {
  shopFqdn: string
  appId: string
}

export interface DevSessionCreateOptions extends DevSessionSharedOptions {
  assetsUrl?: string
  websocketUrl?: string
}

export interface DevSessionUpdateOptions extends DevSessionSharedOptions {
  assetsUrl?: string
  manifest: AppManifest
  inheritedModuleUids: string[]
  websocketUrl?: string
}

export type DevSessionDeleteOptions = DevSessionSharedOptions

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

export interface AppLogsSuccess {
  app_logs: AppLogData[]
  cursor?: string
  status: number
}

export interface AppLogsError {
  errors: string[]
  status: number
}

export type AppLogsResponse = AppLogsSuccess | AppLogsError

export interface UserError {
  field?: string[] | null
  message: string
  category: string
  details: ErrorDetail[]
  on?: JsonMapType
}

interface ErrorDetail {
  extension_id?: number | string
  extension_title?: string
  specification_identifier?: string
  [key: string]: unknown
}

export interface DeveloperPlatformClient {
  readonly clientName: ClientName
  readonly webUiName: string
  readonly supportsAtomicDeployments: boolean
  readonly supportsDevSessions: boolean
  readonly supportsStoreSearch: boolean
  readonly organizationSource: OrganizationSource
  readonly bundleFormat: 'zip' | 'br'
  readonly supportsDashboardManagedExtensions: boolean
  session: () => Promise<Session>
  /**
   * This is an unsafe method that should only be used when the session is expired.
   * It is not safe to use this method in other contexts as it may lead to race conditions.
   * Use only if you know what you are doing.
   */
  unsafeRefreshToken: () => Promise<string>
  accountInfo: () => Promise<Session['accountInfo']>
  appFromIdentifiers: (apiKey: string) => Promise<OrganizationApp | undefined>
  organizations: () => Promise<Organization[]>
  orgFromId: (orgId: string) => Promise<Organization | undefined>
  orgAndApps: (orgId: string) => Promise<Paginateable<{organization: Organization; apps: MinimalOrganizationApp[]}>>
  appsForOrg: (orgId: string, term?: string) => Promise<Paginateable<{apps: MinimalOrganizationApp[]}>>
  specifications: (app: MinimalAppIdentifiers) => Promise<RemoteSpecification[]>
  templateSpecifications: (app: MinimalAppIdentifiers) => Promise<ExtensionTemplatesResult>
  createApp: (org: Organization, options: CreateAppOptions) => Promise<OrganizationApp>
  devStoresForOrg: (orgId: string, searchTerm?: string) => Promise<Paginateable<{stores: OrganizationStore[]}>>
  storeByDomain: (orgId: string, shopDomain: string) => Promise<OrganizationStore | undefined>
  ensureUserAccessToStore: (orgId: string, store: OrganizationStore) => Promise<void>
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
  sendSampleWebhook: (input: SendSampleWebhookVariables, organizationId: string) => Promise<SendSampleWebhookSchema>
  apiVersions: (organizationId: string) => Promise<PublicApiVersionsSchema>
  topics: (input: WebhookTopicsVariables, organizationId: string) => Promise<WebhookTopicsSchema>
  migrateFlowExtension: (input: MigrateFlowExtensionVariables) => Promise<MigrateFlowExtensionSchema>
  migrateAppModule: (input: MigrateAppModuleVariables) => Promise<MigrateAppModuleSchema>
  updateURLs: (input: UpdateURLsVariables) => Promise<UpdateURLsSchema>
  currentAccountInfo: () => Promise<CurrentAccountInfoSchema>
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
  subscribeToAppLogs: (
    input: AppLogsSubscribeMutationVariables,
    organizationId: string,
  ) => Promise<AppLogsSubscribeMutation>
  appLogs: (options: AppLogsOptions, organizationId: string) => Promise<AppLogsResponse>
  appDeepLink: (app: MinimalAppIdentifiers) => Promise<string>
  devSessionCreate: (input: DevSessionCreateOptions) => Promise<DevSessionCreateMutation>
  devSessionUpdate: (input: DevSessionUpdateOptions) => Promise<DevSessionUpdateMutation>
  devSessionDelete: (input: DevSessionSharedOptions) => Promise<DevSessionDeleteMutation>
  getCreateDevStoreLink: (org: Organization) => Promise<TokenItem>
}

const inProgressRefreshes = new WeakMap<DeveloperPlatformClient, Promise<string>>()

/**
 * Creates an unauthorized handler for a developer platform client that will refresh the token
 * and return the appropriate token based on the token type.
 * If the tokenType is 'businessPlatform', the handler will return the business platform token.
 * Otherwise, it will return the default token (App Management API or Partners API).
 * @param client - The developer platform client.
 * @param tokenType - The type of token to return ('default' or 'businessPlatform')
 * @returns The unauthorized handler.
 */
export function createUnauthorizedHandler(
  client: DeveloperPlatformClient,
  tokenType: 'default' | 'businessPlatform' = 'default',
): UnauthorizedHandler {
  return {
    type: 'token_refresh',
    handler: async () => {
      let tokenRefresher = inProgressRefreshes.get(client)
      if (tokenRefresher) {
        await tokenRefresher
      } else {
        try {
          tokenRefresher = client.unsafeRefreshToken()
          inProgressRefreshes.set(client, tokenRefresher)
          await tokenRefresher
        } finally {
          inProgressRefreshes.delete(client)
        }
      }

      // After refresh, get the appropriate token based on the request type
      const session = await client.session()
      const token = tokenType === 'businessPlatform' ? session.businessPlatformToken : session.token
      return {token}
    },
  }
}
