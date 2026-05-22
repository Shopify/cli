import {getOrGenerateSchemaPath, chooseFunction} from './common.js'
import {
  testAppLinked,
  testDeveloperPlatformClient,
  testFunctionExtension,
  testOrganization,
  testOrganizationApp,
} from '../../models/app/app.test-data.js'
import {AppLinkedInterface} from '../../models/app/app.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {FunctionConfigType} from '../../models/extensions/specifications/function.js'
import {generateSchemaService} from '../generate-schema.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {linkedAppContext} from '../app-context.js'
import {describe, vi, expect, beforeEach, test} from 'vitest'
import {renderAutocompletePrompt, renderFatalError} from '@shopify/cli-kit/node/ui'
import {joinPath} from '@shopify/cli-kit/node/path'
import {isTerminalInteractive} from '@shopify/cli-kit/node/context/local'
import {inTemporaryDirectory, writeFile} from '@shopify/cli-kit/node/fs'
import type {Project} from '../../models/project/project.js'
import type {ActiveConfig} from '../../models/project/active-config.js'

vi.mock('../app-context.js')
vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/cli-kit/node/context/local')
vi.mock('../generate-schema.js')

let app: AppLinkedInterface
let ourFunction: ExtensionInstance

beforeEach(async () => {
  ourFunction = await testFunctionExtension()
  app = testAppLinked({allExtensions: [ourFunction]})
  vi.mocked(linkedAppContext).mockResolvedValue({
    app,
    remoteApp: testOrganizationApp(),
    developerPlatformClient: testDeveloperPlatformClient(),
    specifications: [],
    organization: testOrganization(),
    project: {} as unknown as Project,
    activeConfig: {isLinked: true, hiddenConfig: {}} as unknown as ActiveConfig,
  })
  vi.mocked(renderFatalError).mockReturnValue('')
  vi.mocked(renderAutocompletePrompt).mockResolvedValue(ourFunction)
  vi.mocked(isTerminalInteractive).mockReturnValue(true)
})

describe('getOrGenerateSchemaPath', () => {
  let app: AppLinkedInterface
  let developerPlatformClient: DeveloperPlatformClient
  beforeEach(() => {
    app = testAppLinked()
    developerPlatformClient = testDeveloperPlatformClient()
  })

  test('returns the path if the schema file exists', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const extension = {
        directory: tmpDir,
        configuration: {},
      } as ExtensionInstance<FunctionConfigType>
      const expectedPath = joinPath(extension.directory, 'schema.graphql')
      await writeFile(expectedPath, '')

      // When
      // Pass extension, app.directory, clientId, forceRelink, userProvidedConfigName
      const result = await getOrGenerateSchemaPath(extension, app.directory, '123', false, undefined)

      // Then
      expect(result).toBe(expectedPath)
    })
  })

  test('generates the schema file if it does not exist', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const extension = {
        directory: tmpDir,
        configuration: {},
      } as ExtensionInstance<FunctionConfigType>
      const expectedPath = joinPath(extension.directory, 'schema.graphql')

      vi.mocked(generateSchemaService).mockImplementation(async ({extension}) => {
        await writeFile(joinPath(extension.directory, 'schema.graphql'), '')
      })

      // When
      // Pass extension, app.directory, clientId, forceRelink, userProvidedConfigName
      const result = await getOrGenerateSchemaPath(extension, app.directory, '123', false, undefined)

      // Then
      expect(result).toBe(expectedPath)
    })
  })
})

describe('chooseFunction', () => {
  let app: AppLinkedInterface
  let functionExtension1: ExtensionInstance
  let functionExtension2: ExtensionInstance
  let nonFunctionExtension: ExtensionInstance

  beforeEach(async () => {
    functionExtension1 = await testFunctionExtension({
      dir: '/path/to/app/extensions/function-1',
      config: {
        name: 'function-1',
        type: 'product_discounts',
        description: 'Test function 1',
        build: {
          command: 'echo "hello world"',
          watch: ['src/**/*.rs'],
          wasm_opt: true,
        },
        api_version: '2022-07',
        configuration_ui: true,
      },
    })

    functionExtension2 = await testFunctionExtension({
      dir: '/path/to/app/extensions/function-2',
      config: {
        name: 'function-2',
        type: 'product_discounts',
        description: 'Test function 2',
        build: {
          command: 'echo "hello world"',
          watch: ['src/**/*.rs'],
          wasm_opt: true,
        },
        api_version: '2022-07',
        configuration_ui: true,
      },
    })

    nonFunctionExtension = {
      directory: '/path/to/app/extensions/theme',
      isFunctionExtension: false,
      handle: 'theme-extension',
    } as ExtensionInstance
  })

  test('returns the function when path matches a function directory', async () => {
    // Given
    app = testAppLinked({allExtensions: [functionExtension1, functionExtension2, nonFunctionExtension]})

    // When
    const result = await chooseFunction(app, '/path/to/app/extensions/function-1')

    // Then
    expect(result).toBe(functionExtension1)
    expect(renderAutocompletePrompt).not.toHaveBeenCalled()
  })

  test('returns the only function when app has single function and path does not match', async () => {
    // Given
    app = testAppLinked({allExtensions: [functionExtension1, nonFunctionExtension]})

    // When
    const result = await chooseFunction(app, '/some/other/path')

    // Then
    expect(result).toBe(functionExtension1)
    expect(renderAutocompletePrompt).not.toHaveBeenCalled()
  })

  test('prompts user to select function when multiple functions exist and path does not match', async () => {
    // Given
    app = testAppLinked({allExtensions: [functionExtension1, functionExtension2, nonFunctionExtension]})
    vi.mocked(isTerminalInteractive).mockReturnValue(true)
    vi.mocked(renderAutocompletePrompt).mockResolvedValue(functionExtension2)

    // When
    const result = await chooseFunction(app, '/some/other/path')

    // Then
    expect(result).toBe(functionExtension2)
    expect(renderAutocompletePrompt).toHaveBeenCalledWith({
      message: 'Which function?',
      choices: [
        {label: functionExtension1.handle, value: functionExtension1},
        {label: functionExtension2.handle, value: functionExtension2},
      ],
    })
  })

  test('throws error when terminal is not interactive and cannot determine function', async () => {
    // Given
    app = testAppLinked({allExtensions: [functionExtension1, functionExtension2]})
    vi.mocked(isTerminalInteractive).mockReturnValue(false)

    // When/Then
    await expect(chooseFunction(app, '/some/other/path')).rejects.toThrowError(
      'Run this command from a function directory or use `--path` to specify a function directory.',
    )
    expect(renderAutocompletePrompt).not.toHaveBeenCalled()
  })

  test('filters out non-function extensions', async () => {
    // Given
    app = testAppLinked({allExtensions: [nonFunctionExtension]})
    vi.mocked(isTerminalInteractive).mockReturnValue(false)

    // When/Then
    await expect(chooseFunction(app, '/some/path')).rejects.toThrowError(
      'Run this command from a function directory or use `--path` to specify a function directory.',
    )
  })
})
