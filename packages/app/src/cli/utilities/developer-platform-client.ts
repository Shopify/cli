import {PartnersClient} from './developer-platform-client/partners-client.js'
import {ShopifyDevelopersClient} from './developer-platform-client/shopify-developers-client.js'
import {PartnersSession} from '../../cli/services/context/partner-account-info.js'
import {
  MinimalAppIdentifiers,
  MinimalOrganizationApp,
  Organization,
  OrganizationApp,
  OrganizationStore,
} from '../models/organization.js'
import {AllAppExtensionRegistrationsQuerySchema} from '../api/graphql/all_app_extension_registrations.js'
import {ExtensionUpdateDraftInput, ExtensionUpdateSchema} from '../api/graphql/update_draft.js'
import {AppDeploySchema, AppDeployVariables} from '../api/graphql/app_deploy.js'
import {
  GenerateSignedUploadUrlSchema,
  GenerateSignedUploadUrlVariables,
} from '../api/graphql/generate_signed_upload_url.js'
import {ExtensionCreateSchema, ExtensionCreateVariables} from '../api/graphql/extension_create.js'
import {ConvertDevToTestStoreSchema, ConvertDevToTestStoreVariables} from '../api/graphql/convert_dev_to_test_store.js'
import {FindStoreByDomainSchema} from '../api/graphql/find_store_by_domain.js'
import {AppVersionsQuerySchema} from '../api/graphql/get_versions_list.js'
import {
  DevelopmentStorePreviewUpdateInput,
  DevelopmentStorePreviewUpdateSchema,
} from '../api/graphql/development_preview.js'
import {FindAppPreviewModeSchema, FindAppPreviewModeVariables} from '../api/graphql/find_app_preview_mode.js'
import {AppReleaseSchema, AppReleaseVariables} from '../api/graphql/app_release.js'
import {AppVersionByTagSchema, AppVersionByTagVariables} from '../api/graphql/app_version_by_tag.js'
import {AppVersionsDiffSchema, AppVersionsDiffVariables} from '../api/graphql/app_versions_diff.js'
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
import {RemoteSpecification} from '../api/graphql/extension_specifications.js'
import {MigrateAppModuleSchema, MigrateAppModuleVariables} from '../api/graphql/extension_migrate_app_module.js'
import {FunctionUploadUrlGenerateResponse} from '@shopify/cli-kit/node/api/partners'
import {isTruthy} from '@shopify/cli-kit/node/context/utilities'

export type Paginateable<T> = T & {
  hasMorePages: boolean
}

export function selectDeveloperPlatformClient(): DeveloperPlatformClient {
  if (isTruthy(process.env.USE_SHOPIFY_DEVELOPERS_CLIENT)) {
    return new ShopifyDevelopersClient()
  } else {
    return new PartnersClient()
  }
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
  registrationUid?: string
  registrationTitle: string
  config?: object
  type: string
  specification?: AppModuleVersionSpecification
}

export interface ActiveAppVersion {
  appModuleVersions: AppModuleVersion[]
}

export type AppDeployOptions = AppDeployVariables & {
  organizationId: string
}

export interface DeveloperPlatformClient {
  supportsAtomicDeployments: boolean
  requiresOrganization: boolean
  session: () => Promise<PartnersSession>
  refreshToken: () => Promise<string>
  accountInfo: () => Promise<PartnersSession['accountInfo']>
  appFromId: (app: MinimalAppIdentifiers) => Promise<OrganizationApp | undefined>
  organizations: () => Promise<Organization[]>
  orgFromId: (orgId: string) => Promise<Organization | undefined>
  orgAndApps: (orgId: string) => Promise<Paginateable<{organization: Organization; apps: MinimalOrganizationApp[]}>>
  appsForOrg: (orgId: string, term?: string) => Promise<Paginateable<{apps: MinimalOrganizationApp[]}>>
  specifications: (appId: string) => Promise<RemoteSpecification[]>
  templateSpecifications: (appId: string) => Promise<ExtensionTemplate[]>
  createApp: (org: Organization, name: string, options?: CreateAppOptions) => Promise<OrganizationApp>
  devStoresForOrg: (orgId: string) => Promise<OrganizationStore[]>
  storeByDomain: (orgId: string, shopDomain: string) => Promise<FindStoreByDomainSchema>
  appExtensionRegistrations: (app: MinimalAppIdentifiers) => Promise<AllAppExtensionRegistrationsQuerySchema>
  appVersions: (appId: string) => Promise<AppVersionsQuerySchema>
  activeAppVersion: (app: MinimalAppIdentifiers) => Promise<ActiveAppVersion | undefined>
  appVersionByTag: (input: AppVersionByTagVariables) => Promise<AppVersionByTagSchema>
  appVersionsDiff: (input: AppVersionsDiffVariables) => Promise<AppVersionsDiffSchema>
  functionUploadUrl: () => Promise<FunctionUploadUrlGenerateResponse>
  generateSignedUploadUrl: (input: GenerateSignedUploadUrlVariables) => Promise<GenerateSignedUploadUrlSchema>
  createExtension: (input: ExtensionCreateVariables) => Promise<ExtensionCreateSchema>
  updateExtension: (input: ExtensionUpdateDraftInput) => Promise<ExtensionUpdateSchema>
  deploy: (input: AppDeployOptions) => Promise<AppDeploySchema>
  release: (input: AppReleaseVariables) => Promise<AppReleaseSchema>
  convertToTestStore: (input: ConvertDevToTestStoreVariables) => Promise<ConvertDevToTestStoreSchema>
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
}
