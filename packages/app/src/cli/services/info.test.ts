import {InfoOptions, info} from './info.js'
import {AppInterface, AppLinkedInterface} from '../models/app/app.js'
import {AppApiKeyAndOrgId, OrganizationApp, OrganizationSource} from '../models/organization.js'
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
import {OutputMessage, TokenizedString, stringifyMessage, unstyled} from '@shopify/cli-kit/node/output'
import {inTemporaryDirectory, writeFileSync} from '@shopify/cli-kit/node/fs'
import {InlineToken, renderInfo} from '@shopify/cli-kit/node/ui'
import {CLI_KIT_VERSION} from '@shopify/cli-kit/common/version'

type CustomSection = Exclude<Parameters<typeof renderInfo>[0]['customSections'], undefined>[number]

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
  source: OrganizationSource.BusinessPlatform,
}

function buildDeveloperPlatformClient(): DeveloperPlatformClient {
  return testDeveloperPlatformClient({
    async appFromIdentifiers({apiKey}: AppApiKeyAndOrgId): Promise<OrganizationApp> {
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
      const result = stringifyMessage(await info(app, remoteApp, ORG1, infoOptions()))
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
      const result = stringifyMessage(await info(app, remoteApp, ORG1, infoOptions()))
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
      const result = (await info(app, remoteApp, ORG1, {...infoOptions(), webEnv: true})) as OutputMessage

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
      const result = (await info(app, remoteApp, ORG1, {...infoOptions(), format: 'json', webEnv: true})) as OutputMessage

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
      const result = await info(app, remoteApp, ORG1, infoOptions()) as CustomSection[]
      const uiData = tabularDataSectionFromInfo(result, 'ui_extension_external')
      const checkoutData = tabularDataSectionFromInfo(result, 'checkout_ui_extension_external')

      // Then

      // Doesn't use the type as part of the title
      expect(JSON.stringify(uiData)).not.toContain('📂 ui_extension')

      // Shows handle as title
      const uiExtensionTitle = uiData[0]![0]
      expect(uiExtensionTitle).toBe('📂 handle-for-extension-1')
      // Displays errors
      const uiExtensionErrorsRow = errorRow(uiData)
      expect(uiExtensionErrorsRow[1]).toStrictEqual({error: 'Mock error with ui_extension'})

      // Shows default handle derived from name when no handle is present
      const checkoutExtensionTitle = checkoutData[0]![0]
      expect(checkoutExtensionTitle).toBe('📂 extension-2')
      // Displays errors
      const checkoutExtensionErrorsRow = errorRow(checkoutData)
      expect(checkoutExtensionErrorsRow[1]).toStrictEqual({error: 'Mock error with checkout_ui_extension'})
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
      const result = (await info(app, remoteApp, ORG1, infoOptions())) as CustomSection[]
      const uiExtensionsData = tabularDataSectionFromInfo(result, 'ui_extension_external')
      const relevantExtension = extensionTitleRow(uiExtensionsData, 'handle-for-extension-1')
      const irrelevantExtension = extensionTitleRow(uiExtensionsData, 'point_of_sale')

      // Then
      expect(relevantExtension).toBeDefined()
      expect(irrelevantExtension).not.toBeDefined()
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
      const result = await info(app, remoteApp, ORG1, {format: 'json', webEnv: false, developerPlatformClient})

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

function tabularDataSectionFromInfo(info: CustomSection[], title: string): InlineToken[][] {
  const section = info.find((section) => section.title === title)
  if (!section) throw new Error(`Section ${title} not found`)
  if (!(typeof section.body === 'object' && 'tabularData' in section.body)) {
    throw new Error(`Expected to be a table: ${JSON.stringify(section.body)}`)
  }
  return section.body.tabularData
}

function errorRow(data: InlineToken[][]): InlineToken[] {
  const row = data.find((row: InlineToken[]) => typeof row[0] === 'object' && 'error' in row[0])!
  if (!row) throw new Error('Error row not found')
  return row
}

function extensionTitleRow(data: InlineToken[][], title: string): InlineToken[] | undefined {
  return data.find((row) => typeof row[0] === 'string' && row[0].match(new RegExp(title)))
}
