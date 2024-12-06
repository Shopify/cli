import {InfoOptions, info} from './info.js'
import {AppInterface, AppLinkedInterface} from '../models/app/app.js'
import {MinimalAppIdentifiersPossiblyExcludingId, OrganizationApp} from '../models/organization.js'
import {selectOrganizationPrompt} from '../prompts/dev.js'
import {
  testDeveloperPlatformClient,
  testOrganizationApp,
  testUIExtension,
  testAppConfigExtensions,
  testAppLinked,
} from '../models/app/app.test-data.js'
import {AppErrors} from '../models/app/loader.js'
import {DeveloperPlatformClient} from '../utilities/developer-platform-client.js'
import {describe, expect, vi, test} from 'vitest'
import {checkForNewVersion} from '@shopify/cli-kit/node/node-package-manager'
import {joinPath} from '@shopify/cli-kit/node/path'
import {TokenizedString, stringifyMessage, unstyled} from '@shopify/cli-kit/node/output'
import {inTemporaryDirectory, writeFileSync} from '@shopify/cli-kit/node/fs'
import {CLI_KIT_VERSION} from '@shopify/cli-kit/common/version'

vi.mock('../prompts/dev.js')
vi.mock('@shopify/cli-kit/node/node-package-manager')
vi.mock('../utilities/developer-platform-client.js')

const APP = testOrganizationApp()
const APP1 = testOrganizationApp({id: '123', title: 'my app', apiKey: '12345'})

const ORG1 = {
  id: '123',
  flags: {},
  businessName: 'test',
  apps: {nodes: []},
}

function buildDeveloperPlatformClient(): DeveloperPlatformClient {
  return testDeveloperPlatformClient({
    async appFromIdentifiers({apiKey}: MinimalAppIdentifiersPossiblyExcludingId): Promise<OrganizationApp> {
      switch (apiKey) {
        case '123':
          return APP1
        case APP.apiKey:
          return APP
        default:
          throw new Error(`App not found for client ID ${apiKey}`)
      }
    },

    async organizations() {
      return [ORG1]
    },

    async appsForOrg(organizationId: string, _term?: string) {
      switch (organizationId) {
        case '123':
          return {
            apps: [APP, APP1].map((org) => ({
              id: org.id,
              title: org.title,
              apiKey: org.apiKey,
              organizationId: org.id,
            })),
            hasMorePages: false,
          }
        default:
          throw new Error(`Organization not found for ID ${organizationId}`)
      }
    },
  })
}

function infoOptions(): InfoOptions {
  return {
    format: 'text',
    webEnv: false,
    developerPlatformClient: buildDeveloperPlatformClient(),
  }
}

describe('info', () => {
  const remoteApp = testOrganizationApp()

  test('returns update shopify cli reminder when last version is greater than current version', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const latestVersion = '2.2.3'
      const app = mockApp({directory: tmp})
      vi.mocked(checkForNewVersion).mockResolvedValue(latestVersion)

      // When
      const result = stringifyMessage(await info(app, remoteApp, infoOptions()))
      // Then
      expect(unstyled(result)).toMatch(`Shopify CLI       ${CLI_KIT_VERSION}`)
    })
  })

  test('returns update shopify cli reminder when last version lower or equals to current version', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const app = mockApp({directory: tmp})
      vi.mocked(checkForNewVersion).mockResolvedValue(undefined)

      // When
      const result = stringifyMessage(await info(app, remoteApp, infoOptions()))
      // Then
      expect(unstyled(result)).toMatch(`Shopify CLI       ${CLI_KIT_VERSION}`)
      expect(unstyled(result)).not.toMatch('CLI reminder')
    })
  })

  test('returns the web environment as a text when webEnv is true', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const app = mockApp({directory: tmp})

      vi.mocked(selectOrganizationPrompt).mockResolvedValue(ORG1)

      // When
      const result = await info(app, remoteApp, {...infoOptions(), webEnv: true})

      // Then
      expect(unstyled(stringifyMessage(result))).toMatchInlineSnapshot(`
      "
          SHOPIFY_API_KEY=api-key
          SHOPIFY_API_SECRET=api-secret
          SCOPES=my-scope
        "
      `)
    })
  })

  test('returns the web environment as a json when webEnv is true', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const app = mockApp({directory: tmp})
      vi.mocked(selectOrganizationPrompt).mockResolvedValue(ORG1)

      // When
      const result = await info(app, remoteApp, {...infoOptions(), format: 'json', webEnv: true})

      // Then
      expect(unstyled(stringifyMessage(result))).toMatchInlineSnapshot(`
        "{
          \\"SHOPIFY_API_KEY\\": \\"api-key\\",
          \\"SHOPIFY_API_SECRET\\": \\"api-secret\\",
          \\"SCOPES\\": \\"my-scope\\"
        }"
      `)
    })
  })

  test('returns errors alongside extensions when extensions have errors', async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const uiExtension1 = await testUIExtension({
        configuration: {
          name: 'Extension 1',
          handle: 'handle-for-extension-1',
          type: 'ui_extension',
          metafields: [],
        },
        configurationPath: 'extension/path/1',
      })
      const uiExtension2 = await testUIExtension({
        configuration: {
          name: 'Extension 2',
          type: 'checkout_ui_extension',
          metafields: [],
        },
        configurationPath: 'extension/path/2',
      })

      const errors = new AppErrors()
      errors.addError(uiExtension1.configurationPath, 'Mock error with ui_extension')
      errors.addError(uiExtension2.configurationPath, 'Mock error with checkout_ui_extension')

      const app = mockApp({
        directory: tmp,
        app: {
          errors,
          allExtensions: [uiExtension1, uiExtension2],
        },
      })
      vi.mocked(selectOrganizationPrompt).mockResolvedValue(ORG1)

      // When
      const result = await info(app, remoteApp, infoOptions())

      // Then
      expect(result).toContain('Extensions with errors')
      // Doesn't use the type as part of the title
      expect(result).not.toContain('📂 ui_extension')
      // Shows handle in title
      expect(result).toContain('📂 handle-for-extension-1')
      // Shows default handle derived from name when no handle is present
      expect(result).toContain('📂 extension-2')
      expect(result).toContain('! Mock error with ui_extension')
      expect(result).toContain('! Mock error with checkout_ui_extension')
    })
  })

  test("doesn't return extensions not supported using the default output format", async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const uiExtension1 = await testUIExtension({
        configuration: {
          path: 'extension/path/1',
          name: 'Extension 1',
          handle: 'handle-for-extension-1',
          type: 'ui_extension',
          metafields: [],
        },
      })
      const configExtension = await testAppConfigExtensions()

      const app = mockApp({
        directory: tmp,
        app: {
          allExtensions: [uiExtension1, configExtension],
        },
      })
      vi.mocked(selectOrganizationPrompt).mockResolvedValue(ORG1)

      // When
      const result = await info(app, remoteApp, infoOptions())

      // Then
      expect(result).toContain('📂 handle-for-extension-1')
      expect(result).not.toContain('📂 point_of_sale')
    })
  })

  test("doesn't return extensions not supported using the json output format", async () => {
    await inTemporaryDirectory(async (tmp) => {
      // Given
      const uiExtension1 = await testUIExtension({
        configuration: {
          path: 'extension/path/1',
          name: 'Extension 1',
          handle: 'handle-for-extension-1',
          type: 'ui_extension',
          metafields: [],
        },
      })
      const configExtension = await testAppConfigExtensions()
      const developerPlatformClient = testDeveloperPlatformClient()
      const app = mockApp({
        directory: tmp,
        app: {
          allExtensions: [uiExtension1, configExtension],
        },
      })
      vi.mocked(selectOrganizationPrompt).mockResolvedValue(ORG1)

      // When
      const result = await info(app, remoteApp, {format: 'json', webEnv: false, developerPlatformClient})

      // Then
      expect(result).toBeInstanceOf(TokenizedString)
      const resultObject = JSON.parse((result as TokenizedString).value) as AppInterface
      const extensionsIdentifiers = resultObject.allExtensions.map((extension) => extension.localIdentifier)
      expect(extensionsIdentifiers).toContain('handle-for-extension-1')
      expect(extensionsIdentifiers).not.toContain('point_of_sale')
    })
  })
})

function mockApp({
  directory,
  currentVersion = '2.2.2',
  configContents = 'scopes = "read_products"',
  app,
}: {
  directory: string
  currentVersion?: string
  configContents?: string
  app?: Partial<AppInterface>
}): AppLinkedInterface {
  const nodeDependencies: {[key: string]: string} = {}
  nodeDependencies['@shopify/cli'] = currentVersion

  writeFileSync(joinPath(directory, 'shopify.app.toml'), configContents)

  return testAppLinked({
    name: 'my app',
    directory,
    configuration: {
      path: joinPath(directory, 'shopify.app.toml'),
      scopes: 'my-scope',
      extension_directories: ['extensions/*'],
    },
    nodeDependencies,
    ...(app ? app : {}),
  })
}
