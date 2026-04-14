import {testOrganization, testOrganizationApp, testPartnersUserSession} from './fixtures.js'
import {testRemoteExtensionTemplates, testRemoteSpecifications} from './templates.js'
import {
  Organization,
  OrganizationStore,
  MinimalAppIdentifiers,
  MinimalOrganizationApp,
  OrganizationSource,
} from '../../organization.js'
import {AllAppExtensionRegistrationsQuerySchema} from '../../../api/graphql/all_app_extension_registrations.js'
import {AppDeploySchema, AppDeployVariables} from '../../../api/graphql/app_deploy.js'
import {ExtensionCreateSchema, ExtensionCreateVariables} from '../../../api/graphql/extension_create.js'
import {ConvertDevToTransferDisabledStoreVariables} from '../../../api/graphql/convert_dev_to_transfer_disabled_store.js'
import {
  DevelopmentStorePreviewUpdateInput,
  DevelopmentStorePreviewUpdateSchema,
} from '../../../api/graphql/development_preview.js'
import {FindAppPreviewModeSchema, FindAppPreviewModeVariables} from '../../../api/graphql/find_app_preview_mode.js'
import {SendSampleWebhookSchema, SendSampleWebhookVariables} from '../../../services/webhook/request-sample.js'
import {PublicApiVersionsSchema} from '../../../services/webhook/request-api-versions.js'
import {WebhookTopicsSchema, WebhookTopicsVariables} from '../../../services/webhook/request-topics.js'
import {AppReleaseSchema} from '../../../api/graphql/app_release.js'
import {AppVersionsDiffSchema, AppVersionsDiffVariables} from '../../../api/graphql/app_versions_diff.js'
import {
  MigrateFlowExtensionSchema,
  MigrateFlowExtensionVariables,
} from '../../../api/graphql/extension_migrate_flow_extension.js'
import {UpdateURLsSchema, UpdateURLsVariables} from '../../../api/graphql/update_urls.js'
import {CurrentAccountInfoSchema} from '../../../api/graphql/current_account_info.js'
import {
  MigrateToUiExtensionSchema,
  MigrateToUiExtensionVariables,
} from '../../../api/graphql/extension_migrate_to_ui_extension.js'
import {MigrateAppModuleSchema, MigrateAppModuleVariables} from '../../../api/graphql/extension_migrate_app_module.js'
import {AppLogsSubscribeResponse} from '../../../api/graphql/subscribe_to_app_logs.js'
import {
  ExtensionUpdateDraftMutation,
  ExtensionUpdateDraftMutationVariables,
} from '../../../api/graphql/partners/generated/update-draft.js'
import {SchemaDefinitionByTargetQueryVariables} from '../../../api/graphql/functions/generated/schema-definition-by-target.js'
import {SchemaDefinitionByApiTypeQueryVariables} from '../../../api/graphql/functions/generated/schema-definition-by-api-type.js'
import {AppLogsOptions} from '../../../services/app-logs/utils.js'
import {AppLogsSubscribeMutationVariables} from '../../../api/graphql/app-management/generated/app-logs-subscribe.js'
import {
  AppLogsResponse,
  AppVersion,
  AppVersionIdentifiers,
  AppVersionWithContext,
  AssetUrlSchema,
  ClientName,
  CreateAppOptions,
  DeveloperPlatformClient,
  DevSessionCreateOptions,
  DevSessionDeleteOptions,
  DevSessionUpdateOptions,
  Store,
} from '../../../utilities/developer-platform-client.js'
import {vi} from 'vitest'

const emptyAppExtensionRegistrations: AllAppExtensionRegistrationsQuerySchema = {
  app: {
    extensionRegistrations: [],
    configurationRegistrations: [],
    dashboardManagedExtensionRegistrations: [],
  },
}

const emptyAppVersions = {
  app: {
    id: 'app-id',
    organizationId: 'org-id',
    title: 'my app',
    appVersions: {
      nodes: [],
      pageInfo: {
        totalResults: 0,
      },
    },
  },
}

const emptyActiveAppVersion: AppVersion = {
  appModuleVersions: [],
}

const appVersionByTagResponse: AppVersionWithContext = {
  id: 1,
  uuid: 'uuid',
  versionTag: 'version-tag',
  location: 'location',
  message: 'MESSAGE',
  appModuleVersions: [],
}

const appVersionsDiffResponse: AppVersionsDiffSchema = {
  app: {
    versionsDiff: {
      added: [],
      updated: [],
      removed: [],
    },
  },
}

export const extensionCreateResponse: ExtensionCreateSchema = {
  extensionCreate: {
    extensionRegistration: {
      id: 'extension-id',
      uuid: 'extension-uuid',
      title: 'my extension',
      type: 'other',
      draftVersion: {
        config: 'config',
        registrationId: 'registration-id',
        lastUserInteractionAt: '2024-01-01',
        validationErrors: [],
      },
    },
    userErrors: [],
  },
}

const extensionUpdateResponse: ExtensionUpdateDraftMutation = {
  extensionUpdateDraft: {
    userErrors: [],
  },
}

const deployResponse: AppDeploySchema = {
  appDeploy: {
    appVersion: {
      uuid: 'uuid',
      id: 1,
      versionTag: 'version-tag',
      location: 'location',
      message: 'message',
      appModuleVersions: [],
    },
    userErrors: [],
  },
}

const releaseResponse: AppReleaseSchema = {
  appRelease: {
    appVersion: {
      versionTag: 'version-tag',
      location: 'location',
      message: 'message',
    },
    userErrors: [],
  },
}

const generateSignedUploadUrlResponse: AssetUrlSchema = {
  assetUrl: 'signed-upload-url',
  userErrors: [],
}

const convertedToTransferDisabledStoreResponse = {
  convertDevToTestStore: {
    convertedToTestStore: true,
    userErrors: [],
  },
}

const updateDeveloperPreviewResponse: DevelopmentStorePreviewUpdateSchema = {
  developmentStorePreviewUpdate: {
    app: {
      id: 'app-id',
      developmentStorePreviewEnabled: true,
    },
    userErrors: [],
  },
}

const appPreviewModeResponse: FindAppPreviewModeSchema = {
  app: {
    developmentStorePreviewEnabled: true,
  },
}

const organizationsResponse: Organization[] = [testOrganization()]

const sendSampleWebhookResponse: SendSampleWebhookSchema = {
  sendSampleWebhook: {
    samplePayload: '{ "sampleField": "SampleValue" }',
    headers: '{ "header": "Header Value" }',
    success: true,
    userErrors: [],
  },
}

const migrateFlowExtensionResponse: MigrateFlowExtensionSchema = {
  migrateFlowExtension: {
    migratedFlowExtension: true,
    userErrors: [],
  },
}

const migrateAppModuleResponse: MigrateAppModuleSchema = {
  migrateAppModule: {
    migratedAppModule: true,
    userErrors: [],
  },
}

const apiVersionsResponse: PublicApiVersionsSchema = {
  publicApiVersions: ['2022', 'unstable', '2023'],
}

const topicsResponse: WebhookTopicsSchema = {
  webhookTopics: ['orders/create', 'shop/redact'],
}

const updateURLsResponse: UpdateURLsSchema = {
  appUpdate: {
    userErrors: [],
  },
}

const currentAccountInfoResponse: CurrentAccountInfoSchema = {
  currentAccountInfo: {
    __typename: 'UserAccount',
    email: 'user@example.com',
  },
}

const migrateToUiExtensionResponse: MigrateToUiExtensionSchema = {
  migrateToUiExtension: {
    migratedToUiExtension: true,
    userErrors: [],
  },
}

const appLogsSubscribeResponse: AppLogsSubscribeResponse = {
  appLogsSubscribe: {
    success: true,
    jwtToken: 'jwttoken',
  },
}

export function testDeveloperPlatformClient(stubs: Partial<DeveloperPlatformClient> = {}): DeveloperPlatformClient {
  const clientStub: DeveloperPlatformClient = {
    clientName: ClientName.AppManagement,
    webUiName: 'Test Dashboard',
    supportsAtomicDeployments: false,
    supportsDevSessions: stubs.supportsDevSessions ?? false,
    supportsStoreSearch: false,
    organizationSource: OrganizationSource.BusinessPlatform,
    bundleFormat: 'zip',
    supportsDashboardManagedExtensions: true,
    session: () => Promise.resolve(testPartnersUserSession),
    unsafeRefreshToken: () => Promise.resolve(testPartnersUserSession.token),
    accountInfo: () => Promise.resolve(testPartnersUserSession.accountInfo),
    appFromIdentifiers: (_apiKey: string) => Promise.resolve(testOrganizationApp({}, clientStub as DeveloperPlatformClient)),
    organizations: () => Promise.resolve(organizationsResponse),
    orgFromId: (_organizationId: string) => Promise.resolve(testOrganization()),
    appsForOrg: (_organizationId: string) => Promise.resolve({apps: [testOrganizationApp({}, clientStub as DeveloperPlatformClient)], hasMorePages: false}),
    specifications: (_app: MinimalAppIdentifiers) => Promise.resolve(testRemoteSpecifications),
    templateSpecifications: (_app: MinimalAppIdentifiers) =>
      Promise.resolve({templates: testRemoteExtensionTemplates, groupOrder: []}),
    orgAndApps: (_orgId: string) =>
      Promise.resolve({organization: testOrganization(), apps: [testOrganizationApp({}, clientStub as DeveloperPlatformClient)], hasMorePages: false}),
    createApp: (_organization: Organization, _options: CreateAppOptions) => Promise.resolve(testOrganizationApp({}, clientStub as DeveloperPlatformClient)),
    devStoresForOrg: (_organizationId: string) => Promise.resolve({stores: [], hasMorePages: false}),
    storeByDomain: (_orgId: string, _shopDomain: string, _storeTypes: Store[]) => Promise.resolve(undefined),
    ensureUserAccessToStore: (_orgId: string, _store: OrganizationStore) => Promise.resolve(),
    appExtensionRegistrations: (_app: MinimalAppIdentifiers) => Promise.resolve(emptyAppExtensionRegistrations),
    appVersions: (_app: MinimalAppIdentifiers) => Promise.resolve(emptyAppVersions),
    activeAppVersion: (_app: MinimalAppIdentifiers) => Promise.resolve(emptyActiveAppVersion),
    appVersionByTag: (_app: MinimalOrganizationApp, _tag: string) => Promise.resolve(appVersionByTagResponse),
    appVersionsDiff: (_input: AppVersionsDiffVariables) => Promise.resolve(appVersionsDiffResponse),
    createExtension: (_input: ExtensionCreateVariables) => Promise.resolve(extensionCreateResponse),
    updateExtension: (_input: ExtensionUpdateDraftMutationVariables) => Promise.resolve(extensionUpdateResponse),
    deploy: (_input: AppDeployVariables) => Promise.resolve(deployResponse),
    release: (_input: {app: MinimalAppIdentifiers; version: AppVersionIdentifiers}) => Promise.resolve(releaseResponse),
    generateSignedUploadUrl: (_app: MinimalAppIdentifiers) => Promise.resolve(generateSignedUploadUrlResponse),
    convertToTransferDisabledStore: (_input: ConvertDevToTransferDisabledStoreVariables) =>
      Promise.resolve(convertedToTransferDisabledStoreResponse),
    updateDeveloperPreview: (_input: DevelopmentStorePreviewUpdateInput) =>
      Promise.resolve(updateDeveloperPreviewResponse),
    appPreviewMode: (_input: FindAppPreviewModeVariables) => Promise.resolve(appPreviewModeResponse),
    sendSampleWebhook: (_input: SendSampleWebhookVariables) => Promise.resolve(sendSampleWebhookResponse),
    apiVersions: () => Promise.resolve(apiVersionsResponse),
    topics: (_input: WebhookTopicsVariables) => Promise.resolve(topicsResponse),
    migrateFlowExtension: (_input: MigrateFlowExtensionVariables) => Promise.resolve(migrateFlowExtensionResponse),
    migrateAppModule: (_input: MigrateAppModuleVariables) => Promise.resolve(migrateAppModuleResponse),
    updateURLs: (_input: UpdateURLsVariables) => Promise.resolve(updateURLsResponse),
    currentAccountInfo: () => Promise.resolve(currentAccountInfoResponse),
    targetSchemaDefinition: (_input: SchemaDefinitionByTargetQueryVariables & {apiKey?: string}, _orgId: string) =>
      Promise.resolve('schema'),
    apiSchemaDefinition: (_input: SchemaDefinitionByApiTypeQueryVariables & {apiKey?: string}, _orgId: string) =>
      Promise.resolve('schema'),
    migrateToUiExtension: (_input: MigrateToUiExtensionVariables) => Promise.resolve(migrateToUiExtensionResponse),
    toExtensionGraphQLType: (input: string) => input,
    subscribeToAppLogs: (_input: AppLogsSubscribeMutationVariables) => Promise.resolve(appLogsSubscribeResponse),
    appLogs: (_options: AppLogsOptions): Promise<AppLogsResponse> =>
      Promise.resolve({
        app_logs: [
          {
            shop_id: 123,
            api_client_id: 456,
            payload: '{}',
            log_type: 'log',
            source: 'test',
            source_namespace: 'test',
            cursor: 'log-cursor',
            status: 'success',
            log_timestamp: '2024-01-01T00:00:00Z',
          },
        ],
        cursor: 'cursor',
        status: 200,
      }),
    appDeepLink: (app: MinimalAppIdentifiers) =>
      Promise.resolve(`https://test.shopify.com/${app.organizationId}/apps/${app.id}`),
    devSessionCreate: (_input: DevSessionCreateOptions) => Promise.resolve({devSessionCreate: {userErrors: []}}),
    devSessionUpdate: (_input: DevSessionUpdateOptions) => Promise.resolve({devSessionUpdate: {userErrors: []}}),
    devSessionDelete: (_input: DevSessionDeleteOptions) => Promise.resolve({devSessionDelete: {userErrors: []}}),
    getCreateDevStoreLink: (org: Organization) =>
      Promise.resolve(
        `Looks like you don't have any dev stores associated with ${org.businessName}'s Partner Dashboard. Create one now https://partners.shopify.com/1234/stores`,
      ),
    ...stubs,
  }
  const retVal: Partial<DeveloperPlatformClient> = clientStub
  for (const [key, value] of Object.entries(clientStub)) {
    if (typeof value === 'function') {
      retVal[
        key as keyof Omit<
          DeveloperPlatformClient,
          | 'supportsAtomicDeployments'
          | 'clientName'
          | 'webUiName'
          | 'supportsDevSessions'
          | 'supportsStoreSearch'
          | 'organizationSource'
          | 'bundleFormat'
          | 'supportsDashboardManagedExtensions'
        >
      ] = vi.fn().mockImplementation(value)
    }
  }
  return retVal as DeveloperPlatformClient
}
