import {ClientName, MigrationDeveloperPlatformClient, createUnauthorizedHandler} from '../developer-platform-client.js'
import {OrganizationSource} from '../../models/organization.js'
import {
  MigrateFlowExtensionVariables,
  MigrateFlowExtensionSchema,
  MigrateFlowExtensionMutation,
} from '../../api/graphql/extension_migrate_flow_extension.js'
import {
  MigrateToUiExtensionVariables,
  MigrateToUiExtensionSchema,
  MigrateToUiExtensionQuery,
} from '../../api/graphql/extension_migrate_to_ui_extension.js'
import {
  MigrateAppModuleMutation,
  MigrateAppModuleSchema,
  MigrateAppModuleVariables,
} from '../../api/graphql/extension_migrate_app_module.js'
import {isUnitTest} from '@shopify/cli-kit/node/context/local'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'
import {CacheOptions, GraphQLVariables, UnauthorizedHandler} from '@shopify/cli-kit/node/api/graphql'
import {ensureAuthenticatedPartners, Session} from '@shopify/cli-kit/node/session'
import {RequestModeInput} from '@shopify/cli-kit/node/http'

/**
 * The Partners-backed client now exists solely to run the legacy extension migrations
 * (see {@link MigrationDeveloperPlatformClient}). Every other developer platform operation is
 * served by the App Management client, so only the migration mutations and the session/request
 * infrastructure they depend on remain here.
 */
export class PartnersClient implements MigrationDeveloperPlatformClient {
  private static instance: PartnersClient | undefined

  static getInstance(session?: Session): PartnersClient {
    PartnersClient.instance ??= new PartnersClient(session)
    return PartnersClient.instance
  }

  static resetInstance(): void {
    PartnersClient.instance = undefined
  }

  public readonly clientName = ClientName.Partners
  public readonly webUiName = 'Partner Dashboard'
  public readonly organizationSource = OrganizationSource.Partners
  public readonly bundleFormat = 'zip'
  private _session: Session | undefined

  private constructor(session?: Session) {
    this._session = session
  }

  async session(): Promise<Session> {
    if (!this._session) {
      if (isUnitTest()) {
        throw new Error('PartnersClient.session() should not be invoked dynamically in a unit test')
      }
      const {token, userId} = await ensureAuthenticatedPartners()
      this._session = {
        token,
        businessPlatformToken: '',
        accountInfo: {type: 'UnknownAccount'},
        userId,
      }
    }
    return this._session
  }

  async request<T>(
    query: string,
    variables: GraphQLVariables | undefined = undefined,
    cacheOptions?: CacheOptions,
    preferredBehaviour?: RequestModeInput,
  ): Promise<T> {
    return partnersRequest(
      query,
      await this.token(),
      variables,
      cacheOptions,
      preferredBehaviour,
      this.createUnauthorizedHandler(),
    )
  }

  async token(): Promise<string> {
    return (await this.session()).token
  }

  async unsafeRefreshToken(): Promise<string> {
    const {token} = await ensureAuthenticatedPartners([], process.env, {noPrompt: true, forceRefresh: true})
    const session = await this.session()
    if (token) {
      session.token = token
    }
    return session.token
  }

  async migrateFlowExtension(input: MigrateFlowExtensionVariables): Promise<MigrateFlowExtensionSchema> {
    return this.request(MigrateFlowExtensionMutation, input)
  }

  async migrateAppModule(input: MigrateAppModuleVariables): Promise<MigrateAppModuleSchema> {
    return this.request(MigrateAppModuleMutation, input)
  }

  async migrateToUiExtension(input: MigrateToUiExtensionVariables): Promise<MigrateToUiExtensionSchema> {
    return this.request(MigrateToUiExtensionQuery, input)
  }

  private createUnauthorizedHandler(): UnauthorizedHandler {
    return createUnauthorizedHandler(this)
  }
}
