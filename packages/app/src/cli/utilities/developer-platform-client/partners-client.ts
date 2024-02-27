import {CreateAppQuery, CreateAppQuerySchema} from '../../api/graphql/create_app.js'
import {
  AllDevStoresByOrganizationQuery,
  AllDevStoresByOrganizationSchema,
} from '../../api/graphql/all_dev_stores_by_org.js'
import {DeveloperPlatformClient, Paginateable} from '../developer-platform-client.js'
import {fetchPartnersSession, PartnersSession} from '../../../cli/services/context/partner-account-info.js'
import {
  fetchAppDetailsFromApiKey,
  fetchOrganizations,
  fetchOrgAndApps,
  fetchOrgFromId,
  filterDisabledBetas,
} from '../../../cli/services/dev/fetch.js'
import {MinimalOrganizationApp, Organization, OrganizationApp, OrganizationStore} from '../../models/organization.js'
import {selectOrganizationPrompt} from '../../prompts/dev.js'
import {ExtensionSpecification} from '../../models/extensions/specification.js'
import {fetchSpecifications} from '../../services/generate/fetch-extension-specifications.js'
import {isUnitTest} from '@shopify/cli-kit/node/context/local'
import {AbortError} from '@shopify/cli-kit/node/error'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'

// this is a temporary solution for editions to support https://vault.shopify.io/gsd/projects/31406
// read more here: https://vault.shopify.io/gsd/projects/31406
const MAGIC_URL = 'https://shopify.dev/apps/default-app-home'
const MAGIC_REDIRECT_URL = 'https://shopify.dev/apps/default-app-home/api/auth'

interface AppVars {
  org: number
  title: string
  appUrl: string
  redir: string[]
  requestedAccessScopes: string[]
  type: string
}

function getAppVars(org: Organization, name: string, isLaunchable = true, scopesArray?: string[]): AppVars {
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
  private _session: PartnersSession | undefined

  constructor(session?: PartnersSession) {
    this._session = session
  }

  async session(): Promise<PartnersSession> {
    if (!this._session) {
      if (isUnitTest()) {
        throw new Error('PartnersClient.session() should not be invoked dynamically in a unit test')
      }
      this._session = await fetchPartnersSession()
    }
    return this._session
  }

  async token(): Promise<string> {
    return (await this.session()).token
  }

  async accountInfo(): Promise<PartnersSession['accountInfo']> {
    return (await this.session()).accountInfo
  }

  async appFromId(appId: string): Promise<OrganizationApp | undefined> {
    return fetchAppDetailsFromApiKey(appId, await this.token())
  }

  async organizations(): Promise<Organization[]> {
    return fetchOrganizations(await this.session())
  }

  async selectOrg(): Promise<Organization> {
    const organizations = await this.organizations()
    return selectOrganizationPrompt(organizations)
  }

  async orgFromId(orgId: string): Promise<Organization> {
    return fetchOrgFromId(orgId, await this.session())
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

  async specifications(appId: string): Promise<ExtensionSpecification[]> {
    return fetchSpecifications({token: await this.token(), apiKey: appId})
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
    const variables = getAppVars(org, name, options?.isLaunchable, options?.scopesArray)

    const query = CreateAppQuery
    const result: CreateAppQuerySchema = await partnersRequest(query, await this.token(), variables)
    if (result.appCreate.userErrors.length > 0) {
      const errors = result.appCreate.userErrors.map((error) => error.message).join(', ')
      throw new AbortError(errors)
    }

    const betas = filterDisabledBetas(result.appCreate.app.disabledBetas)
    return {...result.appCreate.app, organizationId: org.id, newApp: true, betas}
  }

  async devStoresForOrg(orgId: string): Promise<OrganizationStore[]> {
    const query = AllDevStoresByOrganizationQuery
    const result: AllDevStoresByOrganizationSchema = await partnersRequest(query, await this.token(), {
      id: orgId,
    })
    return result.organizations.nodes[0]!.stores.nodes
  }
}
