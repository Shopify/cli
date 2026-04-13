import {
  App,
  AppSchema,
  AppConfiguration,
  AppInterface,
  AppLinkedInterface,
  CurrentAppConfiguration,
  WebType,
  getAppVersionedSchema,
} from '../app.js'
import {AppErrors} from '../loader.js'
import {
  Organization,
  OrganizationStore,
  OrganizationApp,
  OrganizationSource,
} from '../../organization.js'
import {WebhooksConfig} from '../../extensions/specifications/types/app_config_webhook.js'
import {loadLocalExtensionsSpecifications} from '../../extensions/load-specifications.js'
import {DeveloperPlatformClient} from '../../../utilities/developer-platform-client.js'
import {Project} from '../../project/project.js'
import {Session} from '@shopify/cli-kit/node/session'
import {PackageManager} from '@shopify/cli-kit/node/node-package-manager'

export const DEFAULT_CONFIG = {
  application_url: 'https://myapp.com',
  client_id: 'api-key',
  name: 'my app',
  webhooks: {
    api_version: '2023-04',
  },
  embedded: true,
  access_scopes: {
    scopes: 'read_products',
    use_legacy_install_flow: true,
  },
}

export function testApp(app: Partial<AppInterface> = {}): AppInterface {
  const getConfig = () => {
    return DEFAULT_CONFIG as CurrentAppConfiguration
  }

  const newApp = new App({
    name: app.name ?? 'App',
    directory: app.directory ?? '/tmp/project',
    configPath: app.configPath ?? '/tmp/project/shopify.app.toml',
    configuration: app.configuration ?? getConfig(),
    webs: app.webs ?? [
      {
        directory: '',
        configuration: {
          roles: [WebType.Backend],
          commands: {dev: ''},
        },
      },
    ],
    modules: app.allExtensions ?? [],
    dotenv: app.dotenv,
    errors: app.errors ?? new AppErrors(),
    specifications: app.specifications ?? [],
    configSchema: (app.configSchema ?? AppSchema) as any,
    remoteFlags: app.remoteFlags ?? [],
    hiddenConfig: app.hiddenConfig ?? {},
    devApplicationURLs: app.devApplicationURLs,
  })

  if (app.extensionsForType) {
    Object.getPrototypeOf(newApp).extensionsForType = app.extensionsForType
  }
  return newApp
}

export function testAppLinked(app: Partial<AppInterface> = {}): AppLinkedInterface {
  return testApp(app) as AppLinkedInterface
}

interface TestAppWithConfigOptions {
  app?: Partial<AppInterface>
  config: object
}

export function testAppWithConfig(options?: TestAppWithConfigOptions): AppLinkedInterface {
  const app = testAppLinked(options?.app)
  app.configuration = {
    ...DEFAULT_CONFIG,
    ...options?.config,
  } as CurrentAppConfiguration

  return app
}

interface TestProjectOptions {
  directory?: string
  packageManager?: PackageManager
  nodeDependencies?: Record<string, string>
  usesWorkspaces?: boolean
}

/**
 * Creates a minimal Project mock for testing.
 * Use this when a service needs a Project for packageManager, usesWorkspaces, or directory.
 */
export function testProject(options: TestProjectOptions = {}): Project {
  return {
    directory: options.directory ?? '/tmp/project',
    packageManager: options.packageManager ?? 'yarn',
    nodeDependencies: options.nodeDependencies ?? {},
    usesWorkspaces: options.usesWorkspaces ?? false,
    appConfigFiles: [],
    extensionConfigFiles: [],
    webConfigFiles: [],
    dotenvFiles: new Map(),
    hiddenConfigRaw: {},
    appConfigByName: () => undefined,
    appConfigByClientId: () => undefined,
    defaultAppConfig: undefined,
  } as unknown as Project
}

export function getWebhookConfig(webhookConfigOverrides?: WebhooksConfig): CurrentAppConfiguration {
  return {
    ...DEFAULT_CONFIG,
    webhooks: {
      ...DEFAULT_CONFIG.webhooks,
      ...webhookConfigOverrides,
    },
  }
}

export function testOrganization(): Organization {
  return {
    id: '1',
    businessName: 'org1',
    source: OrganizationSource.BusinessPlatform,
  }
}

export function testOrganizationApp(
  app: Partial<OrganizationApp> = {},
  developerPlatformClient?: DeveloperPlatformClient,
): OrganizationApp {
  const defaultApp = {
    id: '1',
    title: 'app1',
    apiKey: 'api-key',
    apiSecretKeys: [{secret: 'api-secret'}],
    organizationId: '1',
    grantedScopes: [],
    disabledFlags: ['5b25141b'],
    flags: [],
    developerPlatformClient: developerPlatformClient ?? ({} as DeveloperPlatformClient),
  }
  return {...defaultApp, ...app}
}

export const placeholderAppConfiguration: AppConfiguration = {
  client_id: '',
}

export function testOrganizationStore({shopId, shopDomain}: {shopId?: string; shopDomain?: string}): OrganizationStore {
  return {
    shopId: shopId ?? '1',
    link: 'link1',
    shopDomain: shopDomain ?? 'domain1',
    shopName: 'store1',
    transferDisabled: false,
    convertableToPartnerTest: false,
    provisionable: true,
  }
}

export const testPartnersUserSession: Session = {
  token: 'token',
  businessPlatformToken: 'businessPlatformToken',
  accountInfo: {
    type: 'UserAccount',
    email: 'partner@shopify.com',
  },
  userId: '1234-5678',
}

export const testPartnersServiceSession: Session = {
  token: 'partnersToken',
  businessPlatformToken: 'businessPlatformToken',
  accountInfo: {
    type: 'ServiceAccount',
    orgName: 'organization',
  },
  userId: '1234-5678',
}

export async function buildVersionedAppSchema() {
  const configSpecs = await configurationSpecifications()
  return {
    schema: getAppVersionedSchema(configSpecs),
    configSpecifications: configSpecs,
  }
}

export async function configurationSpecifications() {
  return (await loadLocalExtensionsSpecifications()).filter((spec) => spec.uidStrategy === 'single')
}
