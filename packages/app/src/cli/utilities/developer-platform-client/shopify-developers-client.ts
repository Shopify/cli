import {CreateAppMutation, CreateAppMutationVariables, CreateAppMutationSchema} from './shopify-developers-client/graphql/create-app.js'
import {ActiveAppReleaseQuery, ActiveAppReleaseQueryVariables, ActiveAppReleaseQuerySchema} from './shopify-developers-client/graphql/active-app-release.js'
// import {SpecificationsQuery, SpecificationsQueryVariables, SpecificationsQuerySchema} from './shopify-developers-client/graphql/specifications.js'
import {
  // ExtensionSpecificationsQuerySchema,
  FlattenedRemoteSpecification
} from '../../api/graphql/extension_specifications.js'
import {loadLocalExtensionsSpecifications} from '../../models/extensions/load-specifications.js'
import {DeveloperPlatformClient, Paginateable} from '../developer-platform-client.js'
import {PartnersSession} from '../../../cli/services/context/partner-account-info.js'
import {
  filterDisabledBetas,
} from '../../../cli/services/dev/fetch.js'
import {MinimalOrganizationApp, Organization, OrganizationApp, OrganizationStore} from '../../models/organization.js'
import {selectOrganizationPrompt} from '../../prompts/dev.js'
import {ExtensionSpecification} from '../../models/extensions/specification.js'
import {AllAppExtensionRegistrationsQuerySchema} from '../../api/graphql/all_app_extension_registrations.js'
import {ActiveAppVersionQuerySchema} from '../../api/graphql/app_active_version.js'
import {
  GenerateSignedUploadUrlSchema,
  GenerateSignedUploadUrlVariables,
} from '../../api/graphql/generate_signed_upload_url.js'
import {ExtensionUpdateDraftInput, ExtensionUpdateSchema} from '../../api/graphql/update_draft.js'
import {AppDeploySchema, AppDeployVariables} from '../../api/graphql/app_deploy.js'
import {FunctionUploadUrlGenerateResponse} from '@shopify/cli-kit/node/api/partners'
import {randomUUID} from '@shopify/cli-kit/node/crypto'
import {isUnitTest} from '@shopify/cli-kit/node/context/local'
import {AbortError, BugError} from '@shopify/cli-kit/node/error'
import {orgScopedShopifyDevelopersRequest} from '@shopify/cli-kit/node/api/shopify-developers'
import {getArrayRejectingUndefined} from '@shopify/cli-kit/common/array'

const ORG1 = {
  id: '1',
  businessName: 'Test Org',
}

export class ShopifyDevelopersClient implements DeveloperPlatformClient {
  private _session: PartnersSession | undefined

  constructor(session?: PartnersSession) {
    this._session = session
  }

  async session(): Promise<PartnersSession> {
    if (!this._session) {
      if (isUnitTest()) {
        throw new Error('ShopifyDevelopersClient.session() should not be invoked dynamically in a unit test')
      }
      // Need to replace with actual auth
      this._session = {
        token: 'token',
        accountInfo: {
          type: 'UserAccount',
          email: 'mail@example.com',
        }
      }
    }
    return this._session
  }

  async token(): Promise<string> {
    return (await this.session()).token
  }

  async refreshToken(): Promise<string> {
    return this.token()
  }

  async accountInfo(): Promise<PartnersSession['accountInfo']> {
    return (await this.session()).accountInfo
  }

  async appFromId(_appId: string): Promise<OrganizationApp | undefined> {
    throw new BugError('Not implemented: appFromId')
  }

  async organizations(): Promise<Organization[]> {
    return [ORG1]
  }

  async selectOrg(): Promise<Organization> {
    const organizations = await this.organizations()
    return selectOrganizationPrompt(organizations)
  }

  async orgFromId(orgId: string): Promise<Organization> {
    if (orgId === '1') return ORG1

    throw new BugError(`Cannot fetch organization with id ${orgId}`)
  }

  async orgAndApps(orgId: string): Promise<Paginateable<{organization: Organization; apps: MinimalOrganizationApp[]}>> {
    if (orgId === '1') {
      return {
        organization: ORG1,
        apps: [],
        hasMorePages: false,
      }
    } else {
      throw new BugError(`Cannot fetch organization with id ${orgId}`)
    }
  }

  async appsForOrg(_organizationId: string, _term?: string): Promise<Paginateable<{apps: MinimalOrganizationApp[]}>> {
    return {
      apps: [],
      hasMorePages: false,
    }
  }

  async specifications(_appId: string): Promise<ExtensionSpecification[]> {
    return stubbedExtensionSpecifications()
    // // This should be the actual query, but it's not working at the moment...
    // const query = SpecificationsQuery
    // const variables: SpecificationsQueryVariables = {appId}
    // const result = await orgScopedShopifyDevelopersRequest<SpecificationsQuerySchema>(ORG1.id, query, await this.token(), variables)
    // console.log(JSON.stringify(result, null, 2))
    // return result.specifications.map((spec): ExtensionSpecification => ({
      // externalName: spec.name,
      // additionalIdentifiers: [],
      // partnersWebIdentifier: spec.identifier,
      // surface: '',
      // registrationLimit: 1,
      // appModuleFeatures: (_config) => [],
      // ...spec,
      // experience: spec.experience.toLowerCase() as 'extension' | 'configuration',
    // }))
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
    const variables = createAppVars(name, options?.isLaunchable, options?.scopesArray)

    const mutation = CreateAppMutation
    const result = await orgScopedShopifyDevelopersRequest<CreateAppMutationSchema>(org.id, mutation, await this.token(), variables)
    if (result.appCreate.userErrors?.length > 0) {
      const errors = result.appCreate.userErrors.map((error) => error.message).join(', ')
      throw new AbortError(errors)
    }

    // Need to figure this out still
    const betas = filterDisabledBetas([])
    const createdApp = result.appCreate.app
    return {...createdApp, title: name, apiKey: createdApp.id, apiSecretKeys: [], grantedScopes: options?.scopesArray ?? [], organizationId: org.id, newApp: true, betas}
  }

  async devStoresForOrg(_orgId: string): Promise<OrganizationStore[]> {
    return []
  }

  async appExtensionRegistrations(_appId: string): Promise<AllAppExtensionRegistrationsQuerySchema> {
    throw new BugError('Not implemented: appExtensionRegistrations')
  }

  async activeAppVersion(appId: string, orgId: string): Promise<ActiveAppVersionQuerySchema> {
    const query = ActiveAppReleaseQuery
    const variables: ActiveAppReleaseQueryVariables = {appId}
    const result = await orgScopedShopifyDevelopersRequest<ActiveAppReleaseQuerySchema>(orgId, query, await this.token(), variables)
    return {
      app: {
        activeAppVersion: {
          appModuleVersions: result.app.activeRelease.version.modules.map((mod) => {
            return {
              registrationId: mod.gid,
              registrationUuid: mod.gid,
              registrationTitle: mod.handle,
              type: mod.specification.identifier,
              config: mod.config,
              specification: {
                ...mod.specification,
                options: { managementExperience: 'cli' },
                experience: mod.specification.experience.toLowerCase() as "configuration" | "extension" | "deprecated",
              },
            }
          }),
          ...result.app.activeRelease,
        }
      }
    }
  }

  async functionUploadUrl(): Promise<FunctionUploadUrlGenerateResponse> {
    throw new BugError('Not implemented: functionUploadUrl')
  }

  async generateSignedUploadUrl(_input: GenerateSignedUploadUrlVariables): Promise<GenerateSignedUploadUrlSchema> {
    throw new BugError('Not implemented: generateSignedUploadUrl')
  }

  async updateExtension(_input: ExtensionUpdateDraftInput): Promise<ExtensionUpdateSchema> {
    throw new BugError('Not implemented: updateExtension')
  }

  async deploy(_input: AppDeployVariables): Promise<AppDeploySchema> {
    throw new BugError('Not implemented: deploy')
  }
}

interface AppModule {
  uuid: string
  title: string
  specificationIdentifier: string
  config: string
}

// this is a temporary solution for editions to support https://vault.shopify.io/gsd/projects/31406
// read more here: https://vault.shopify.io/gsd/projects/31406
const MAGIC_URL = 'https://shopify.dev/apps/default-app-home'
const MAGIC_REDIRECT_URL = 'https://shopify.dev/apps/default-app-home/api/auth'

function createAppVars(name: string, isLaunchable = true, scopesArray?: string[]): CreateAppMutationVariables {
  return {
    appModules: [
      {
        uuid: randomUUID(),
        title: 'home',
        specificationIdentifier: 'app_home',
        config: JSON.stringify({
          app_url: isLaunchable ? 'https://example.com' : MAGIC_URL,
          embedded: isLaunchable,
        })
      },
      {
        uuid: randomUUID(),
        title: 'branding',
        specificationIdentifier: 'branding',
        config: JSON.stringify({name}),
      },
      {
        uuid: randomUUID(),
        title: 'webhooks',
        specificationIdentifier: 'webhooks',
        config: JSON.stringify({api_version: '2024-01'}),
      },
      {
        uuid: randomUUID(),
        title: 'app access',
        specificationIdentifier: 'app_access',
        config: JSON.stringify({
          redirect_url_allowlist: isLaunchable ? ['https://example.com/api/auth'] : [MAGIC_REDIRECT_URL],
          ...(scopesArray && {scopes: scopesArray.map((scope) => scope.trim()).join(',')}),
        }),
      },
    ]
  }
}

async function stubbedExtensionSpecifications(): Promise<ExtensionSpecification[]> {
  const extensionSpecifications: FlattenedRemoteSpecification[] = [
    {
      "name": "App access",
      "externalName": "App access",
      "externalIdentifier": "app_access",
      "identifier": "app_access",
      "gated": false,
      "experience": "configuration",
      "registrationLimit": 1,
      "options": {
        "managementExperience": "cli",
        "registrationLimit": 1,
      },
      "features": {
        "argo": undefined
      }
    },
    {
      "name": "App Home",
      "externalName": "App Home",
      "externalIdentifier": "app_home",
      "identifier": "app_home",
      "gated": false,
      "experience": "configuration",
      "registrationLimit": 1,
      "options": {
        "managementExperience": "cli",
        "registrationLimit": 1,
      },
      "features": {
        "argo": undefined
      }
    },
    {
      "name": "Branding",
      "externalName": "Branding",
      "externalIdentifier": "branding",
      "identifier": "branding",
      "gated": false,
      "experience": "configuration",
      "registrationLimit": 1,
      "options": {
        "managementExperience": "cli",
        "registrationLimit": 1,
      },
      "features": {
        "argo": undefined
      }
    },
    {
      "name": "Webhooks",
      "externalName": "Webhooks",
      "externalIdentifier": "webhooks",
      "identifier": "webhooks",
      "gated": false,
      "experience": "configuration",
      "registrationLimit": 1,
      "options": {
        "managementExperience": "cli",
        "registrationLimit": 1
      },
      "features": {
        "argo": undefined,
      }
    },
  ]

  const local = await loadLocalExtensionsSpecifications()
  const updatedSpecs = mergeLocalAndRemoteSpecs(local, extensionSpecifications)
  return [...updatedSpecs]
}

function mergeLocalAndRemoteSpecs(
  local: ExtensionSpecification[],
  remote: FlattenedRemoteSpecification[],
): ExtensionSpecification[] {
  const updated = local.map((spec) => {
    const remoteSpec = remote.find((remote) => remote.identifier === spec.identifier)
    if (remoteSpec) return {...spec, ...remoteSpec} as ExtensionSpecification
    return undefined
  })

  return getArrayRejectingUndefined<ExtensionSpecification>(updated)
}
