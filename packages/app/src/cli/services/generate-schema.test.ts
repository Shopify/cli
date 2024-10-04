import {generateSchemaService} from './generate-schema.js'
import * as localEnvironment from './context.js'
import * as localStorage from './local-storage.js'
import {ApiSchemaDefinitionQueryVariables} from '../api/graphql/functions/api_schema_definition.js'
import {
  testApp,
  testDeveloperPlatformClient,
  testFunctionExtension,
  testOrganizationApp,
} from '../models/app/app.test-data.js'
import * as identifiers from '../models/app/identifiers.js'
import {inTemporaryDirectory, readFile} from '@shopify/cli-kit/node/fs'
import {AbortError} from '@shopify/cli-kit/node/error'
import {isTerminalInteractive} from '@shopify/cli-kit/node/context/local'
import {beforeEach, describe, expect, vi, test, MockedFunction} from 'vitest'
import {joinPath} from '@shopify/cli-kit/node/path'
import * as output from '@shopify/cli-kit/node/output'

vi.mock('@shopify/cli-kit/node/context/local')
vi.mock('../../../models/app/loader.ts')
vi.mock('../models/app/identifiers.js', async () => {
  const identifiers: any = await vi.importActual('../models/app/identifiers.js')
  return {
    ...identifiers,
    getAppIdentifiers: vi.fn(),
    getCachedAppInfo: vi.fn(),
  }
})
vi.mock('./context.js', async () => {
  const context: any = await vi.importActual('./context.js')
  return {
    ...context,
    fetchOrCreateOrganizationApp: vi.fn(),
  }
})
vi.mock('./local-storage.js', async () => {
  const localStorage: any = await vi.importActual('./local-storage.js')
  return {
    ...localStorage,
    setCachedAppInfo: vi.fn(),
    getCachedAppInfo: vi.fn(),
  }
})

vi.mock('./context')
vi.mock('./local-storage')
vi.mock('./local-storage.js', async () => {
  const localStorage: any = await vi.importActual('./local-storage.js')
  return {
    ...localStorage,
    setCachedAppInfo: vi.fn(),
  }
})
vi.mock('../utilities/developer-platform-client')
vi.mock('../models/app/identifiers')

describe('generateSchemaService', () => {
  test('Save the latest GraphQL schema to ./[extension]/schema.graphql when stdout flag is ABSENT', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const app = testApp()
      const extension = await testFunctionExtension({})
      const apiKey = 'api-key'
      const path = tmpDir

      // When
      await generateSchemaService({
        app,
        extension,
        apiKey,
        path,
        stdout: false,
        developerPlatformClient: testDeveloperPlatformClient(),
      })

      // Then
      const outputFile = await readFile(joinPath(tmpDir, 'schema.graphql'))
      expect(outputFile).toEqual('schema')
    })
  })

  test('Print the latest GraphQL schema to stdout when stdout flag is PRESENT', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const app = testApp()
      const extension = await testFunctionExtension()
      const apiKey = 'api-key'
      const path = tmpDir
      const stdout = true
      const mockOutput = vi.fn()
      vi.spyOn(output, 'outputInfo').mockImplementation(mockOutput)

      // When
      await generateSchemaService({
        app,
        extension,
        apiKey,
        path,
        stdout,
        developerPlatformClient: testDeveloperPlatformClient(),
      })

      // Then
      expect(mockOutput).toHaveBeenCalledWith('schema')
    })
  })

  describe('GraphQL query', () => {
    test('Uses ApiSchemaDefinitionQuery when not using targets', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const app = testApp()
        const extension = await testFunctionExtension({
          config: {
            name: 'test function extension',
            description: 'description',
            type: 'api_type',
            build: {
              command: 'echo "hello world"',
            },
            api_version: 'unstable',
            configuration_ui: true,
            metafields: [],
          },
        })
        const apiKey = 'api-key'
        const path = tmpDir
        const {
          configuration: {api_version: version},
          type,
        } = extension
        const developerPlatformClient = testDeveloperPlatformClient()

        // When
        await generateSchemaService({
          app,
          extension,
          apiKey,
          path,
          stdout: false,
          developerPlatformClient,
        })

        // Then
        expect(developerPlatformClient.apiSchemaDefinition).toHaveBeenCalledWith({
          apiKey,
          version,
          type,
        })
      })
    })

    test('Uses TargetSchemaDefinitionQuery when targets present', async () => {
      await inTemporaryDirectory(async (tmpDir) => {
        // Given
        const app = testApp()
        const extension = await testFunctionExtension({
          config: {
            name: 'test function extension',
            description: 'description',
            type: 'function',
            targeting: [
              {
                target: 'first',
              },
              {
                target: 'second',
              },
            ],
            build: {
              command: 'echo "hello world"',
            },
            api_version: 'unstable',
            configuration_ui: true,
            metafields: [],
          },
        })
        const apiKey = 'api-key'
        const path = tmpDir
        const expectedTarget = extension.configuration.targeting![0]!.target
        const version = extension.configuration.api_version
        const developerPlatformClient = testDeveloperPlatformClient()

        // When
        await generateSchemaService({
          app,
          extension,
          apiKey,
          path,
          stdout: false,
          developerPlatformClient,
        })

        // Then
        expect(developerPlatformClient.targetSchemaDefinition).toHaveBeenCalledWith({
          apiKey,
          version,
          target: expectedTarget,
        })
      })
    })
  })

  test('aborts if a schema could not be generated', async () => {
    // Given
    const app = testApp()
    const extension = await testFunctionExtension()
    const apiKey = 'api-key'
    const developerPlatformClient = testDeveloperPlatformClient({
      apiSchemaDefinition: (_input: ApiSchemaDefinitionQueryVariables) => Promise.resolve(null),
    })

    // When
    const result = generateSchemaService({
      app,
      extension,
      apiKey,
      path: '',
      stdout: true,
      developerPlatformClient,
    })

    // Then
    await expect(result).rejects.toThrow(AbortError)
  })

  describe('API key', () => {
    const apiKey = 'api-key'
    const identifiersApiKey = 'identifier-api-key'
    const promptApiKey = 'prompt-api-key'

    const getAppIdentifiers = identifiers.getAppIdentifiers as MockedFunction<typeof identifiers.getAppIdentifiers>
    const fetchOrCreateOrganizationApp = localEnvironment.fetchOrCreateOrganizationApp as MockedFunction<
      typeof localEnvironment.fetchOrCreateOrganizationApp
    >
    const setCachedAppInfo = localStorage.setCachedAppInfo as MockedFunction<typeof localStorage.setCachedAppInfo>
    const getCachedAppInfo = localStorage.getCachedAppInfo as MockedFunction<typeof localStorage.getCachedAppInfo>

    beforeEach(async () => {
      getAppIdentifiers.mockReturnValue({app: identifiersApiKey})
      fetchOrCreateOrganizationApp.mockResolvedValue(
        testOrganizationApp({
          apiKey: promptApiKey,
        }),
      )
      vi.mocked(isTerminalInteractive).mockReturnValue(true)
    })

    test('uses options API key if provided', async () => {
      // Given
      const app = testApp()
      const extension = await testFunctionExtension()
      const {
        configuration: {api_version: version},
        type,
      } = extension
      const developerPlatformClient = testDeveloperPlatformClient()

      // When
      await generateSchemaService({
        app,
        extension,
        apiKey,
        path: '',
        stdout: true,
        developerPlatformClient,
      })

      // Then
      expect(developerPlatformClient.apiSchemaDefinition).toHaveBeenCalledWith({
        apiKey,
        version,
        type,
      })
    })

    test('uses app identifier API key, if options API key is not provided', async () => {
      // Given
      const app = testApp()
      const extension = await testFunctionExtension()
      const {
        configuration: {api_version: version},
        type,
      } = extension
      const developerPlatformClient = testDeveloperPlatformClient()

      // When
      await generateSchemaService({
        app,
        extension,
        path: '',
        stdout: true,
        developerPlatformClient,
      })

      // Then
      expect(developerPlatformClient.apiSchemaDefinition).toHaveBeenCalledWith({
        apiKey: identifiersApiKey,
        version,
        type,
      })
    })

    test('prompts for app if no API key is provided and sets cached api key when in interactive mode', async () => {
      // Given
      const app = testApp()
      const extension = await testFunctionExtension()
      const {
        configuration: {api_version: version},
        type,
      } = extension
      getAppIdentifiers.mockReturnValue({app: undefined})
      const developerPlatformClient = testDeveloperPlatformClient()

      // When
      await generateSchemaService({
        app,
        extension,
        path: '',
        stdout: true,
        developerPlatformClient,
      })

      // Then
      expect(developerPlatformClient.apiSchemaDefinition).toHaveBeenCalledWith({
        apiKey: promptApiKey,
        version,
        type,
      })

      expect(fetchOrCreateOrganizationApp).toHaveBeenCalled()
      expect(setCachedAppInfo).toHaveBeenCalledWith({
        apiKey: promptApiKey,
        directory: app.directory,
      })
    })

    test('uses cached API key when no API key is provided and cache exists', async () => {
      // Given
      const app = testApp()
      const extension = await testFunctionExtension()
      const {
        configuration: {api_version: version},
        type,
      } = extension
      const cachedApiKey = 'cached-api-key'

      vi.spyOn(localStorage, 'getCachedAppInfo').mockResolvedValue({apiKey: cachedApiKey, directory: app.directory})
      vi.mocked(getAppIdentifiers).mockReturnValue({app: undefined})
      const developerPlatformClient = testDeveloperPlatformClient()

      // When
      await generateSchemaService({
        app,
        extension,
        path: '',
        stdout: true,
        developerPlatformClient,
      })

      // Then
      expect(localStorage.getCachedAppInfo).toHaveBeenCalledWith(app.directory)
      expect(developerPlatformClient.apiSchemaDefinition).toHaveBeenCalledWith({
        apiKey: cachedApiKey,
        version,
        type,
      })
      expect(fetchOrCreateOrganizationApp).not.toHaveBeenCalled()
      expect(setCachedAppInfo).not.toHaveBeenCalled()
    })

    test('aborts if no API key is provided in non-interactive mode', async () => {
      // Given
      const app = testApp()
      const extension = await testFunctionExtension()
      getAppIdentifiers.mockReturnValue({app: undefined})
      vi.mocked(isTerminalInteractive).mockReturnValue(false)
      const developerPlatformClient = testDeveloperPlatformClient()

      // When
      const result = generateSchemaService({
        app,
        extension,
        path: '',
        stdout: true,
        developerPlatformClient: testDeveloperPlatformClient(),
      })

      await expect(result).rejects.toThrow()
      expect(developerPlatformClient.apiSchemaDefinition).not.toHaveBeenCalled()
    })
  })
})
