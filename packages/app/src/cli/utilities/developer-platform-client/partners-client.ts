/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {CreateAppQuery, CreateAppQuerySchema, CreateAppQueryVariables} from '../../api/graphql/create_app.js'
import {
  ActiveAppVersion,
  AppDeployOptions,
  AssetUrlSchema,
  AppVersionIdentifiers,
  DeveloperPlatformClient,
  Paginateable,
  DevSessionOptions,
  filterDisabledFlags,
  ClientName,
} from '../developer-platform-client.js'
import {fetchCurrentAccountInformation, PartnersSession} from '../../../cli/services/context/partner-account-info.js'
import {
  MinimalAppIdentifiers,
  MinimalOrganizationApp,
  Organization,
  OrganizationApp,
  OrganizationSource,
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
  ConvertDevToTransferDisabledStoreQuery,
  ConvertDevToTransferDisabledSchema,
  ConvertDevToTransferDisabledStoreVariables,
} from '../../api/graphql/convert_dev_to_transfer_disabled_store.js'
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
import {
  AppLogsSubscribeVariables,
  AppLogsSubscribeMutation,
  AppLogsSubscribeResponse,
} from '../../api/graphql/subscribe_to_app_logs.js'

import {AllOrgs} from '../../api/graphql/partners/generated/all-orgs.js'
import {
  ExtensionUpdateDraft,
  ExtensionUpdateDraftMutation,
  ExtensionUpdateDraftMutationVariables,
} from '../../api/graphql/partners/generated/update-draft.js'
import {FindAppQuery, FindAppQuerySchema, FindAppQueryVariables} from '../../api/graphql/find_app.js'
import {
  FindOrganizationQuery,
  FindOrganizationQuerySchema,
  FindOrganizationQueryVariables,
} from '../../api/graphql/find_org.js'
import {NoOrgError} from '../../services/dev/fetch.js'
import {
  DevStoresByOrg,
  DevStoresByOrgQuery,
  DevStoresByOrgQueryVariables,
} from '../../api/graphql/partners/generated/dev-stores-by-org.js'
import {TypedDocumentNode} from '@graphql-typed-document-node/core'
import {isUnitTest} from '@shopify/cli-kit/node/context/local'
import {AbortError} from '@shopify/cli-kit/node/error'
import {partnersRequest, partnersRequestDoc} from '@shopify/cli-kit/node/api/partners'
import {GraphQLVariables} from '@shopify/cli-kit/node/api/graphql'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'
import {partnersFqdn} from '@shopify/cli-kit/node/context/fqdn'

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
      title: name,
      appUrl: 'https://example.com',
      redir: ['https://example.com/api/auth'],
      requestedAccessScopes: scopesArray ?? [],
      type: 'undecided',
    }
  } else {
    return {
      org: parseInt(org.id, 10),
      title: name,
      appUrl: MAGIC_URL,
      redir: [MAGIC_REDIRECT_URL],
      requestedAccessScopes: scopesArray ?? [],
      type: 'undecided',
    }
  }
}

interface OrganizationAppsResponse {
  pageInfo: {
    hasNextPage: boolean
  }
  nodes: MinimalOrganizationApp[]
}

interface OrgAndAppsResponse {
  organization: Organization
  apps: OrganizationAppsResponse
  stores: OrganizationStore[]
}

export class PartnersClient implements DeveloperPlatformClient {
  public readonly clientName = ClientName.Partners
  public readonly webUiName = 'Partner Dashboard'
  public readonly supportsAtomicDeployments = false
  public readonly requiresOrganization = false
  public readonly supportsDevSessions = false
  private _session: PartnersSession | undefined

  constructor(session?: PartnersSession) {
    this._session = session
  }

  async session(): Promise<PartnersSession> {
    if (!this._session) {
      if (isUnitTest()) {
        throw new Error('PartnersClient.session() should not be invoked dynamically in a unit test')
      }
      const {token, userId} = await ensureAuthenticatedPartners()
      this._session = {
        token,
        accountInfo: {type: 'UnknownAccount'},
        userId,
      }
      const accountInfo = await fetchCurrentAccountInformation(this, userId)
      this._session = {token, accountInfo, userId}
    }
    return this._session
  }

  async request<T>(query: string, variables: GraphQLVariables | undefined = undefined): Promise<T> {
    return partnersRequest(query, await this.token(), variables)
  }

  async requestDoc<TResult, TVariables extends {[key: string]: unknown}>(
    document: TypedDocumentNode<TResult, TVariables>,
    variables?: TVariables,
  ): Promise<TResult> {
    return partnersRequestDoc(document, await this.token(), variables)
  }

  async token(): Promise<string> {
    return (await this.session()).token
  }

  async refreshToken(): Promise<string> {
    const {token} = await ensureAuthenticatedPartners([], process.env, {noPrompt: true})
    const session = await this.session()
    if (token) {
      session.token = token
    }
    return session.token
  }

  async accountInfo(): Promise<PartnersSession['accountInfo']> {
    return (await this.session()).accountInfo
  }

  async appFromId({apiKey}: MinimalAppIdentifiers): Promise<OrganizationApp | undefined> {
    const variables: FindAppQueryVariables = {apiKey}
    const res: FindAppQuerySchema = await this.request(FindAppQuery, variables)
    const app = res.app
    if (app) {
      const flags = filterDisabledFlags(app.disabledFlags)
      return {
        ...app,
        flags,
        developerPlatformClient: this,
      }
    }
  }

  async organizations(): Promise<Organization[]> {
    try {
      const result = await this.requestDoc(AllOrgs)
      return result.organizations.nodes!.map((org) => ({
        id: org!.id,
        businessName: org!.businessName,
        source: OrganizationSource.Partners,
      }))
    } catch (error: unknown) {
      if ((error as {statusCode?: number}).statusCode === 404) {
        return []
      } else {
        throw error
      }
    }
  }

  async orgFromId(orgId: string): Promise<Organization | undefined> {
    const variables: FindOrganizationBasicVariables = {id: orgId}
    const result: FindOrganizationBasicQuerySchema = await this.request(FindOrganizationBasicQuery, variables)
    const org: Organization | undefined = result.organizations.nodes[0]
    if (org) org.source = OrganizationSource.Partners
    return org
  }

  async orgAndApps(orgId: string): Promise<Paginateable<{organization: Organization; apps: MinimalOrganizationApp[]}>> {
    const result = await this.fetchOrgAndApps(orgId)
    return {
      organization: result.organization,
      apps: result.apps.nodes,
      hasMorePages: result.apps.pageInfo.hasNextPage,
    }
  }

  async appsForOrg(organizationId: string, term?: string): Promise<Paginateable<{apps: MinimalOrganizationApp[]}>> {
    const result = await this.fetchOrgAndApps(organizationId, term)
    return {
      apps: result.apps.nodes,
      hasMorePages: result.apps.pageInfo.hasNextPage,
    }
  }

  async specifications({apiKey}: MinimalAppIdentifiers): Promise<RemoteSpecification[]> {
    const variables: ExtensionSpecificationsQueryVariables = {api_key: apiKey}
    const result: ExtensionSpecificationsQuerySchema = await this.request(ExtensionSpecificationsQuery, variables)
    return result.extensionSpecifications
  }

  async templateSpecifications({apiKey}: MinimalAppIdentifiers): Promise<ExtensionTemplate[]> {
    const variables: RemoteTemplateSpecificationsVariables = {apiKey}
    const result: RemoteTemplateSpecificationsSchema = await this.request(RemoteTemplateSpecificationsQuery, variables)
    return result.templateSpecifications.map((template) => {
      const {types, ...rest} = template
      return {
        ...rest,
        ...types[0],
      }
    })
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
    return {...result.appCreate.app, organizationId: org.id, newApp: true, flags, developerPlatformClient: this}
  }

  async devStoresForOrg(orgId: string): Promise<OrganizationStore[]> {
    const variables: DevStoresByOrgQueryVariables = {id: orgId}
    const result: DevStoresByOrgQuery = await this.requestDoc(DevStoresByOrg, variables)
    return result.organizations.nodes![0]!.stores.nodes as OrganizationStore[]
  }

  async appExtensionRegistrations(
    {apiKey}: MinimalAppIdentifiers,
    _activeAppVersion?: ActiveAppVersion,
  ): Promise<AllAppExtensionRegistrationsQuerySchema> {
    const variables: AllAppExtensionRegistrationsQueryVariables = {apiKey}
    return this.request(AllAppExtensionRegistrationsQuery, variables)
  }

  async appVersions({apiKey}: OrganizationApp): Promise<AppVersionsQuerySchema> {
    const variables: AppVersionsQueryVariables = {apiKey}
    return this.request(AppVersionsQuery, variables)
  }

  async appVersionByTag({apiKey}: MinimalOrganizationApp, versionTag: string): Promise<AppVersionByTagSchema> {
    const input: AppVersionByTagVariables = {apiKey, versionTag}
    return this.request(AppVersionByTagQuery, input)
  }

  async appVersionsDiff(
    {apiKey}: MinimalOrganizationApp,
    {appVersionId}: AppVersionIdentifiers,
  ): Promise<AppVersionsDiffSchema> {
    const variables: AppVersionsDiffVariables = {apiKey, versionId: appVersionId}
    return this.request(AppVersionsDiffQuery, variables)
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

  async createExtension(input: ExtensionCreateVariables): Promise<ExtensionCreateSchema> {
    return this.request(ExtensionCreateQuery, input)
  }

  async updateExtension(extensionInput: ExtensionUpdateDraftMutationVariables): Promise<ExtensionUpdateDraftMutation> {
    return this.requestDoc(ExtensionUpdateDraft, extensionInput)
  }

  async deploy(deployInput: AppDeployOptions): Promise<AppDeploySchema> {
    const {organizationId, ...deployOptions} = deployInput
    // Enforce the type
    const variables: AppDeployVariables = deployOptions
    // Exclude uid
    variables.appModules = variables.appModules?.map((element) => {
      const {uid, ...otherFields} = element
      return otherFields
    })
    return this.request(AppDeploy, variables)
  }

  async release({
    app: {apiKey},
    version: {appVersionId},
  }: {
    app: MinimalOrganizationApp
    version: AppVersionIdentifiers
  }): Promise<AppReleaseSchema> {
    const input: AppReleaseVariables = {apiKey, appVersionId}
    return this.request(AppRelease, input)
  }

  async generateSignedUploadUrl(app: MinimalAppIdentifiers): Promise<AssetUrlSchema> {
    const variables: GenerateSignedUploadUrlVariables = {apiKey: app.apiKey, bundleFormat: 1}
    const result = await this.request<GenerateSignedUploadUrlSchema>(GenerateSignedUploadUrl, variables)
    return {
      assetUrl: result.appVersionGenerateSignedUploadUrl.signedUploadUrl,
      userErrors: result.appVersionGenerateSignedUploadUrl.userErrors,
    }
  }

  async convertToTransferDisabledStore(
    input: ConvertDevToTransferDisabledStoreVariables,
  ): Promise<ConvertDevToTransferDisabledSchema> {
    return this.request(ConvertDevToTransferDisabledStoreQuery, input)
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

  async subscribeToAppLogs(input: AppLogsSubscribeVariables): Promise<AppLogsSubscribeResponse> {
    return this.request(AppLogsSubscribeMutation, input)
  }

  async appDeepLink({id, organizationId}: MinimalAppIdentifiers): Promise<string> {
    return `https://${await partnersFqdn()}/${organizationId}/apps/${id}`
  }

  async devSessionCreate(_input: DevSessionOptions): Promise<never> {
    // Dev Sessions are not supported in partners client.
    throw new Error('Unsupported operation')
  }

  async devSessionUpdate(_input: DevSessionOptions): Promise<never> {
    // Dev Sessions are not supported in partners client.
    throw new Error('Unsupported operation')
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async devSessionDelete(_input: unknown): Promise<any> {
    // Dev Sessions are not supported in partners client.
    return Promise.resolve()
  }

  private async fetchOrgAndApps(orgId: string, title?: string): Promise<OrgAndAppsResponse> {
    const params: FindOrganizationQueryVariables = {id: orgId}
    if (title) params.title = title
    const result: FindOrganizationQuerySchema = await this.request(FindOrganizationQuery, params)
    const org = result.organizations.nodes[0]
    if (!org) {
      const partnersSession = await this.session()
      throw new NoOrgError(partnersSession.accountInfo, orgId)
    }
    const parsedOrg = {id: org.id, businessName: org.businessName, source: OrganizationSource.Partners}
    const appsWithOrg = org.apps.nodes.map((app) => ({...app, organizationId: org.id}))
    return {organization: parsedOrg, apps: {...org.apps, nodes: appsWithOrg}, stores: []}
  }
}
