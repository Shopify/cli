import {CreateAppQuery, CreateAppQuerySchema, CreateAppQueryVariables} from '../../api/graphql/create_app.js'
import {
  AllDevStoresByOrganizationQuery,
  AllDevStoresByOrganizationQueryVariables,
  AllDevStoresByOrganizationSchema,
} from '../../api/graphql/all_dev_stores_by_org.js'
import {
  ActiveAppVersion,
  AppDeployOptions,
  DeveloperPlatformClient,
  Paginateable,
} from '../developer-platform-client.js'
import {fetchCurrentAccountInformation, PartnersSession} from '../../../cli/services/context/partner-account-info.js'
import {fetchAppDetailsFromApiKey, fetchOrgAndApps, filterDisabledFlags} from '../../../cli/services/dev/fetch.js'
import {
  MinimalAppIdentifiers,
  MinimalOrganizationApp,
  Organization,
  OrganizationApp,
  OrganizationStore,
} from '../../models/organization.js'
import {
  AllAppExtensionRegistrationsQuery,
  AllAppExtensionRegistrationsQueryVariables,
  AllAppExtensionRegistrationsQuerySchema,
} from '../../api/graphql/all_app_extension_registrations.js'
import {
  ActiveAppVersionQuery,
  ActiveAppVersionQuerySchema,
  ActiveAppVersionQueryVariables,
} from '../../api/graphql/app_active_version.js'
import {
  ExtensionUpdateDraftInput,
  ExtensionUpdateDraftMutation,
  ExtensionUpdateSchema,
} from '../../api/graphql/update_draft.js'
import {AppDeploy, AppDeploySchema, AppDeployVariables} from '../../api/graphql/app_deploy.js'
import {
  GenerateSignedUploadUrl,
  GenerateSignedUploadUrlSchema,
  GenerateSignedUploadUrlVariables,
} from '../../api/graphql/generate_signed_upload_url.js'
import {
  ExtensionCreateQuery,
  ExtensionCreateSchema,
  ExtensionCreateVariables,
} from '../../api/graphql/extension_create.js'
import {
  ConvertDevToTestStoreQuery,
  ConvertDevToTestStoreSchema,
  ConvertDevToTestStoreVariables,
} from '../../api/graphql/convert_dev_to_test_store.js'
import {
  FindStoreByDomainQuery,
  FindStoreByDomainQueryVariables,
  FindStoreByDomainSchema,
} from '../../api/graphql/find_store_by_domain.js'
import {
  AppVersionsQuery,
  AppVersionsQueryVariables,
  AppVersionsQuerySchema,
} from '../../api/graphql/get_versions_list.js'
import {
  DevelopmentStorePreviewUpdateInput,
  DevelopmentStorePreviewUpdateQuery,
  DevelopmentStorePreviewUpdateSchema,
} from '../../api/graphql/development_preview.js'
import {
  FindAppPreviewModeQuery,
  FindAppPreviewModeSchema,
  FindAppPreviewModeVariables,
} from '../../api/graphql/find_app_preview_mode.js'
import {
  AppVersionsDiffQuery,
  AppVersionsDiffSchema,
  AppVersionsDiffVariables,
} from '../../api/graphql/app_versions_diff.js'
import {AppRelease, AppReleaseSchema, AppReleaseVariables} from '../../api/graphql/app_release.js'
import {
  AppVersionByTagQuery,
  AppVersionByTagSchema,
  AppVersionByTagVariables,
} from '../../api/graphql/app_version_by_tag.js'
import {AllOrganizationsQuery, AllOrganizationsQuerySchema} from '../../api/graphql/all_orgs.js'
import {
  SendSampleWebhookSchema,
  SendSampleWebhookVariables,
  sendSampleWebhookMutation,
} from '../../services/webhook/request-sample.js'
import {PublicApiVersionsSchema, GetApiVersionsQuery} from '../../services/webhook/request-api-versions.js'
import {WebhookTopicsSchema, WebhookTopicsVariables, getTopicsQuery} from '../../services/webhook/request-topics.js'
import {
  MigrateFlowExtensionVariables,
  MigrateFlowExtensionSchema,
  MigrateFlowExtensionMutation,
} from '../../api/graphql/extension_migrate_flow_extension.js'
import {UpdateURLsVariables, UpdateURLsSchema, UpdateURLsQuery} from '../../api/graphql/update_urls.js'
import {CurrentAccountInfoQuery, CurrentAccountInfoSchema} from '../../api/graphql/current_account_info.js'
import {
  RemoteTemplateSpecificationsQuery,
  RemoteTemplateSpecificationsSchema,
  RemoteTemplateSpecificationsVariables,
} from '../../api/graphql/template_specifications.js'
import {ExtensionTemplate} from '../../models/app/template.js'
import {
  TargetSchemaDefinitionQueryVariables,
  TargetSchemaDefinitionQuerySchema,
  TargetSchemaDefinitionQuery,
} from '../../api/graphql/functions/target_schema_definition.js'
import {
  ApiSchemaDefinitionQueryVariables,
  ApiSchemaDefinitionQuerySchema,
  ApiSchemaDefinitionQuery,
} from '../../api/graphql/functions/api_schema_definition.js'
import {
  MigrateToUiExtensionVariables,
  MigrateToUiExtensionSchema,
  MigrateToUiExtensionQuery,
} from '../../api/graphql/extension_migrate_to_ui_extension.js'
import {
  ExtensionSpecificationsQuery,
  ExtensionSpecificationsQuerySchema,
  ExtensionSpecificationsQueryVariables,
  RemoteSpecification,
} from '../../api/graphql/extension_specifications.js'
import {
  FindOrganizationBasicQuery,
  FindOrganizationBasicQuerySchema,
  FindOrganizationBasicVariables,
} from '../../api/graphql/find_org_basic.js'
import {
  MigrateAppModuleMutation,
  MigrateAppModuleSchema,
  MigrateAppModuleVariables,
} from '../../api/graphql/extension_migrate_app_module.js'
import {isUnitTest} from '@shopify/cli-kit/node/context/local'
import {AbortError} from '@shopify/cli-kit/node/error'
import {
  FunctionUploadUrlGenerateMutation,
  FunctionUploadUrlGenerateResponse,
  partnersRequest,
} from '@shopify/cli-kit/node/api/partners'
import {GraphQLVariables} from '@shopify/cli-kit/node/api/graphql'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'

// this is a temporary solution for editions to support https://vault.shopify.io/gsd/projects/31406
// read more here: https://vault.shopify.io/gsd/projects/31406
const MAGIC_URL = 'https://shopify.dev/apps/default-app-home'
const MAGIC_REDIRECT_URL = 'https://shopify.dev/apps/default-app-home/api/auth'

function getAppVars(
  org: Organization,
  name: string,
  isLaunchable = true,
  scopesArray?: string[],
): CreateAppQueryVariables {
  if (isLaunchable) {
    return {
      org: parseInt(org.id, 10),
      title: `${name}`,
      appUrl: 'https://example.com',
      redir: ['https://example.com/api/auth'],
      requestedAccessScopes: scopesArray ?? [],
      type: 'undecided',
    }
  } else {
    return {
      org: parseInt(org.id, 10),
      title: `${name}`,
      appUrl: MAGIC_URL,
      redir: [MAGIC_REDIRECT_URL],
      requestedAccessScopes: [],
      type: 'undecided',
    }
  }
}

export class PartnersClient implements DeveloperPlatformClient {
  public supportsAtomicDeployments = false
  public requiresOrganization = false
  private _session: PartnersSession | undefined

  constructor(session?: PartnersSession) {
    this._session = session
  }

  async session(): Promise<PartnersSession> {
    if (!this._session) {
      if (isUnitTest()) {
        throw new Error('PartnersClient.session() should not be invoked dynamically in a unit test')
      }
      const token = await ensureAuthenticatedPartners()
      this._session = {
        token,
        accountInfo: {type: 'UnknownAccount'},
      }
      const accountInfo = await fetchCurrentAccountInformation(this)
      this._session = {token, accountInfo}
    }
    return this._session
  }

  async request<T>(query: string, variables: GraphQLVariables | undefined = undefined): Promise<T> {
    return partnersRequest(query, await this.token(), variables)
  }

  async token(): Promise<string> {
    return (await this.session()).token
  }

  async refreshToken(): Promise<string> {
    const newToken = await ensureAuthenticatedPartners([], process.env, {noPrompt: true})
    const session = await this.session()
    if (newToken) {
      session.token = newToken
    }
    return session.token
  }

  async accountInfo(): Promise<PartnersSession['accountInfo']> {
    return (await this.session()).accountInfo
  }

  async appFromId({apiKey}: MinimalAppIdentifiers): Promise<OrganizationApp | undefined> {
    return fetchAppDetailsFromApiKey(apiKey, await this.token())
  }

  async organizations(): Promise<Organization[]> {
    const result: AllOrganizationsQuerySchema = await this.request(AllOrganizationsQuery)
    return result.organizations.nodes
  }

  async orgFromId(orgId: string): Promise<Organization | undefined> {
    const variables: FindOrganizationBasicVariables = {id: orgId}
    const result: FindOrganizationBasicQuerySchema = await this.request(FindOrganizationBasicQuery, variables)
    return result.organizations.nodes[0]
  }

  async orgAndApps(orgId: string): Promise<Paginateable<{organization: Organization; apps: MinimalOrganizationApp[]}>> {
    const result = await fetchOrgAndApps(orgId, await this.session())
    return {
      organization: result.organization,
      apps: result.apps.nodes,
      hasMorePages: result.apps.pageInfo.hasNextPage,
    }
  }

  async appsForOrg(organizationId: string, term?: string): Promise<Paginateable<{apps: MinimalOrganizationApp[]}>> {
    const result = await fetchOrgAndApps(organizationId, await this.session(), term)
    return {
      apps: result.apps.nodes,
      hasMorePages: result.apps.pageInfo.hasNextPage,
    }
  }

  async specifications(appId: string): Promise<RemoteSpecification[]> {
    const variables: ExtensionSpecificationsQueryVariables = {api_key: appId}
    const result: ExtensionSpecificationsQuerySchema = await this.request(ExtensionSpecificationsQuery, variables)
    return result.extensionSpecifications
  }

  async templateSpecifications(appId: string): Promise<ExtensionTemplate[]> {
    const variables: RemoteTemplateSpecificationsVariables = {apiKey: appId}
    const result: RemoteTemplateSpecificationsSchema = await this.request(RemoteTemplateSpecificationsQuery, variables)
    return result.templateSpecifications
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
    const variables: CreateAppQueryVariables = getAppVars(org, name, options?.isLaunchable, options?.scopesArray)
    const result: CreateAppQuerySchema = await this.request(CreateAppQuery, variables)
    if (result.appCreate.userErrors.length > 0) {
      const errors = result.appCreate.userErrors.map((error) => error.message).join(', ')
      throw new AbortError(errors)
    }

    const flags = filterDisabledFlags(result.appCreate.app.disabledFlags)
    return {...result.appCreate.app, organizationId: org.id, newApp: true, flags}
  }

  async devStoresForOrg(orgId: string): Promise<OrganizationStore[]> {
    const variables: AllDevStoresByOrganizationQueryVariables = {id: orgId}
    const result: AllDevStoresByOrganizationSchema = await this.request(AllDevStoresByOrganizationQuery, variables)
    return result.organizations.nodes[0]!.stores.nodes
  }

  async appExtensionRegistrations({apiKey}: MinimalAppIdentifiers): Promise<AllAppExtensionRegistrationsQuerySchema> {
    const variables: AllAppExtensionRegistrationsQueryVariables = {apiKey}
    return this.request(AllAppExtensionRegistrationsQuery, variables)
  }

  async appVersions(apiKey: string): Promise<AppVersionsQuerySchema> {
    const variables: AppVersionsQueryVariables = {apiKey}
    return this.request(AppVersionsQuery, variables)
  }

  async appVersionByTag(input: AppVersionByTagVariables): Promise<AppVersionByTagSchema> {
    return this.request(AppVersionByTagQuery, input)
  }

  async appVersionsDiff(input: AppVersionsDiffVariables): Promise<AppVersionsDiffSchema> {
    return this.request(AppVersionsDiffQuery, input)
  }

  async activeAppVersion({apiKey}: MinimalAppIdentifiers): Promise<ActiveAppVersion | undefined> {
    const variables: ActiveAppVersionQueryVariables = {apiKey}
    const result = await this.request<ActiveAppVersionQuerySchema>(ActiveAppVersionQuery, variables)
    const version = result.app.activeAppVersion
    if (!version) return
    return {
      ...version,
      appModuleVersions: version.appModuleVersions.map((mod) => {
        return {
          ...mod,
          config: mod.config ? (JSON.parse(mod.config) as object) : {},
        }
      }),
    }
  }

  async functionUploadUrl(): Promise<FunctionUploadUrlGenerateResponse> {
    return this.request(FunctionUploadUrlGenerateMutation)
  }

  async createExtension(input: ExtensionCreateVariables): Promise<ExtensionCreateSchema> {
    return this.request(ExtensionCreateQuery, input)
  }

  async updateExtension(extensionInput: ExtensionUpdateDraftInput): Promise<ExtensionUpdateSchema> {
    return this.request(ExtensionUpdateDraftMutation, extensionInput)
  }

  async deploy(deployInput: AppDeployOptions): Promise<AppDeploySchema> {
    const {organizationId, ...deployOptions} = deployInput
    // Enforce the type
    const variables: AppDeployVariables = deployOptions
    return this.request(AppDeploy, variables)
  }

  async release(input: AppReleaseVariables): Promise<AppReleaseSchema> {
    return this.request(AppRelease, input)
  }

  async generateSignedUploadUrl(input: GenerateSignedUploadUrlVariables): Promise<GenerateSignedUploadUrlSchema> {
    return this.request(GenerateSignedUploadUrl, input)
  }

  async convertToTestStore(input: ConvertDevToTestStoreVariables): Promise<ConvertDevToTestStoreSchema> {
    return this.request(ConvertDevToTestStoreQuery, input)
  }

  async storeByDomain(orgId: string, shopDomain: string): Promise<FindStoreByDomainSchema> {
    const variables: FindStoreByDomainQueryVariables = {orgId, shopDomain}
    return this.request(FindStoreByDomainQuery, variables)
  }

  async updateDeveloperPreview(
    input: DevelopmentStorePreviewUpdateInput,
  ): Promise<DevelopmentStorePreviewUpdateSchema> {
    return this.request(DevelopmentStorePreviewUpdateQuery, input)
  }

  async appPreviewMode(input: FindAppPreviewModeVariables): Promise<FindAppPreviewModeSchema> {
    return this.request(FindAppPreviewModeQuery, input)
  }

  async sendSampleWebhook(input: SendSampleWebhookVariables): Promise<SendSampleWebhookSchema> {
    return this.request(sendSampleWebhookMutation, input)
  }

  async apiVersions(): Promise<PublicApiVersionsSchema> {
    return this.request(GetApiVersionsQuery)
  }

  async topics(input: WebhookTopicsVariables): Promise<WebhookTopicsSchema> {
    return this.request(getTopicsQuery, input)
  }

  async migrateFlowExtension(input: MigrateFlowExtensionVariables): Promise<MigrateFlowExtensionSchema> {
    return this.request(MigrateFlowExtensionMutation, input)
  }

  async migrateAppModule(input: MigrateAppModuleVariables): Promise<MigrateAppModuleSchema> {
    return this.request(MigrateAppModuleMutation, input)
  }

  async updateURLs(input: UpdateURLsVariables): Promise<UpdateURLsSchema> {
    return this.request(UpdateURLsQuery, input)
  }

  async currentAccountInfo(): Promise<CurrentAccountInfoSchema> {
    return this.request(CurrentAccountInfoQuery)
  }

  async targetSchemaDefinition(input: TargetSchemaDefinitionQueryVariables): Promise<string | null> {
    const response: TargetSchemaDefinitionQuerySchema = await this.request(TargetSchemaDefinitionQuery, input)
    return response.definition
  }

  async apiSchemaDefinition(input: ApiSchemaDefinitionQueryVariables): Promise<string | null> {
    const response: ApiSchemaDefinitionQuerySchema = await this.request(ApiSchemaDefinitionQuery, input)
    return response.definition
  }

  async migrateToUiExtension(input: MigrateToUiExtensionVariables): Promise<MigrateToUiExtensionSchema> {
    return this.request(MigrateToUiExtensionQuery, input)
  }

  toExtensionGraphQLType(input: string) {
    return input.toUpperCase()
  }
}
