import generate from './generate.js'
import {ensureGenerateContext} from './context.js'
import {generateExtensionTemplate} from './generate/extension.js'
import {loadApp} from '../models/app/loader.js'
import {
  testAppWithConfig,
  testDeveloperPlatformClient,
  testFunctionExtension,
  testLocalExtensionTemplates,
  testRemoteExtensionTemplates,
  testThemeExtensions,
} from '../models/app/app.test-data.js'
import {ExtensionInstance} from '../models/extensions/extension-instance.js'
import generateExtensionPrompts from '../prompts/generate/extension.js'
import {describe, expect, vi, afterEach, test} from 'vitest'
import {joinPath} from '@shopify/cli-kit/node/path'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'

vi.mock('../constants.js', async () => {
  const actual: any = await vi.importActual('../constants.js')
  return {
    ...actual,
    blocks: {
      ...actual.blocks,
      functions: {
        defaultRegistrationLimit: 1,
      },
    },
  }
})
vi.mock('../models/app/loader.js')
vi.mock('../prompts/generate/extension.js')
vi.mock('../services/generate/extension.js')
vi.mock('../services/context.js')
vi.mock('./local-storage.js')

afterEach(() => {
  mockAndCaptureOutput().clear()
})

describe('generate', () => {
  test('displays a confirmation message with instructions to run dev', async () => {
    // Given
    const outputInfo = await mockSuccessfulCommandExecution('subscription_ui')

    // When
    await generate({directory: '/', reset: false, developerPlatformClient: testDeveloperPlatformClient()})

    // Then
    expect(outputInfo.info()).toMatchInlineSnapshot(`
      "╭─ success ────────────────────────────────────────────────────────────────────╮
      │                                                                              │
      │  Your extension was created in extensions/name.                              │
      │                                                                              │
      │  Next steps                                                                  │
      │    • To preview this extension along with the rest of the project, run       │
      │      \`yarn shopify app dev\`                                                  │
      │                                                                              │
      ╰──────────────────────────────────────────────────────────────────────────────╯
      "
    `)
  })

  test('displays a confirmation message for a theme app extension', async () => {
    // Given
    const outputInfo = await mockSuccessfulCommandExecution('theme_app_extension')

    // When
    await generate({directory: '/', reset: false, developerPlatformClient: testDeveloperPlatformClient()})

    // Then
    expect(outputInfo.info()).toMatchInlineSnapshot(`
      "╭─ success ────────────────────────────────────────────────────────────────────╮
      │                                                                              │
      │  Your extension was created in extensions/name.                              │
      │                                                                              │
      │  Next steps                                                                  │
      │    • To preview this extension along with the rest of the project, run       │
      │      \`yarn shopify app dev\`                                                  │
      │                                                                              │
      ╰──────────────────────────────────────────────────────────────────────────────╯
      "
    `)
  })

  test('displays a confirmation message for a function', async () => {
    // Given
    const outputInfo = await mockSuccessfulCommandExecution('product_discounts')

    // When
    await generate({directory: '/', reset: false, developerPlatformClient: testDeveloperPlatformClient()})

    // Then
    expect(outputInfo.info()).toMatchInlineSnapshot(`
      "╭─ success ────────────────────────────────────────────────────────────────────╮
      │                                                                              │
      │  Your extension was created in extensions/name.                              │
      │                                                                              │
      │  Reference                                                                   │
      │    • For more details, see the docs [1]                                      │
      │                                                                              │
      ╰──────────────────────────────────────────────────────────────────────────────╯
      [1] https://shopify.dev/docs/apps/discounts
      "
    `)
  })

  test('throws error if trying to generate a non existing type', async () => {
    // Given
    await mockSuccessfulCommandExecution('unknown_type')

    // When
    const got = generate({
      directory: '/',
      reset: false,
      template: 'unknown_type',
      developerPlatformClient: testDeveloperPlatformClient(),
    })

    // Then
    await expect(got).rejects.toThrow(/Unknown extension type: unknown_type/)
  })

  test('throws error if trying to generate a extension over the registration limit', async () => {
    // Given
    const themeExtension = await testThemeExtensions()
    await mockSuccessfulCommandExecution('theme_app_extension', [themeExtension])

    // When
    const got = generate({
      directory: '/',
      reset: false,
      template: 'theme_app_extension',
      developerPlatformClient: testDeveloperPlatformClient(),
    })

    // Then
    await expect(got).rejects.toThrow(/Invalid extension type/)
  })

  test('throws error if trying to generate a function over the registration limit', async () => {
    // Given
    const discountsFunction = await testFunctionExtension()
    await mockSuccessfulCommandExecution('product_discounts', [discountsFunction])

    // When
    const got = generate({
      directory: '/',
      reset: false,
      template: 'product_discounts',
      developerPlatformClient: testDeveloperPlatformClient(),
    })

    // Then
    await expect(got).rejects.toThrow(/Invalid extension type/)
  })

  test('throws error if trying to generate with an unsupported flavor', async () => {
    // Given
    await mockSuccessfulCommandExecution('subscription_ui')

    // When
    const got = generate({
      directory: '/',
      reset: false,
      template: 'subscription_ui',
      flavor: 'unknown',
      developerPlatformClient: testDeveloperPlatformClient(),
    })

    // Then
    await expect(got).rejects.toThrow(/Invalid template for extension type/)
  })
})

async function mockSuccessfulCommandExecution(identifier: string, existingExtensions: ExtensionInstance[] = []) {
  const appRoot = '/'
  const app = testAppWithConfig({
    app: {
      directory: appRoot,
      extensionsForType: (_spec: {identifier: string; externalIdentifier: string}) => existingExtensions,
      allExtensions: existingExtensions,
    },
    config: {path: joinPath(appRoot, 'shopify.app.toml')},
  })

  const allExtensionTemplates = testRemoteExtensionTemplates.concat(testLocalExtensionTemplates)
  const extensionTemplate = allExtensionTemplates.find((spec) => spec.identifier === identifier)!

  vi.mocked(loadApp).mockResolvedValue(app)
  vi.mocked(ensureGenerateContext).mockResolvedValue('api-key')
  vi.mocked(generateExtensionPrompts).mockResolvedValue({
    extensionTemplate,
    extensionContent: [
      {
        index: 0,
        name: identifier,
        flavor: 'vanilla-js',
      },
    ],
  })
  vi.mocked(generateExtensionTemplate).mockResolvedValue([
    {directory: joinPath('extensions', 'name'), extensionTemplate},
  ])
  return mockAndCaptureOutput()
}
