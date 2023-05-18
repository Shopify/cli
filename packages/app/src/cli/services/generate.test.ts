import generate from './generate.js'
import {ensureGenerateContext} from './context.js'
import {generateExtensionTemplate} from './generate/extension.js'
import {load as loadApp} from '../models/app/loader.js'
import {
  testApp,
  testFunctionExtension,
  testLocalExtensionTemplates,
  testRemoteSpecifications,
  testRemoteExtensionTemplates,
  testThemeExtensions,
} from '../models/app/app.test-data.js'
import {Extension, FunctionExtension, ThemeExtension, UIExtension} from '../models/app/extensions.js'
import generateExtensionPrompts from '../prompts/generate/extension.js'
import {describe, expect, vi, beforeAll, afterEach, test} from 'vitest'
import {Config} from '@oclif/core'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'
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
vi.mock('@shopify/cli-kit/node/api/partners')
vi.mock('@shopify/cli-kit/node/session')
vi.mock('./local-storage.js')

beforeAll(() => {
  vi.mocked(ensureAuthenticatedPartners).mockResolvedValue('token')
})

afterEach(() => {
  mockAndCaptureOutput().clear()
})

describe('generate', () => {
  const mockConfig = new Config({root: ''})
  test('displays a confirmation message with instructions to run dev', async () => {
    // Given
    const outputInfo = await mockSuccessfulCommandExecution('checkout_ui')

    // When
    await generate({directory: '/', reset: false, config: mockConfig})

    // Then
    expect(outputInfo.info()).toMatchInlineSnapshot(`
      "╭─ success ────────────────────────────────────────────────────────────────────╮
      │                                                                              │
      │  Your extension was created in extensions/name.                              │
      │                                                                              │
      │  Next steps                                                                  │
      │    • To preview this extension along with the rest of the project, run       │
      │      \`yarn dev\`                                                              │
      │                                                                              │
      ╰──────────────────────────────────────────────────────────────────────────────╯
      "
    `)
  })

  test('displays a confirmation message for a theme app extension', async () => {
    // Given
    const outputInfo = await mockSuccessfulCommandExecution('theme_app_extension')

    // When
    await generate({directory: '/', reset: false, config: mockConfig})

    // Then
    expect(outputInfo.info()).toMatchInlineSnapshot(`
      "╭─ success ────────────────────────────────────────────────────────────────────╮
      │                                                                              │
      │  Your extension was created in extensions/name.                              │
      │                                                                              │
      │  Next steps                                                                  │
      │    • To preview this extension along with the rest of the project, run       │
      │      \`yarn dev\`                                                              │
      │                                                                              │
      ╰──────────────────────────────────────────────────────────────────────────────╯
      "
    `)
  })

  test('displays a confirmation message for a function', async () => {
    // Given
    const outputInfo = await mockSuccessfulCommandExecution('product_discounts')

    // When
    await generate({directory: '/', reset: false, config: mockConfig})

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
    const got = generate({directory: '/', reset: false, config: mockConfig, type: 'unknown_type'})

    // Then
    await expect(got).rejects.toThrow(/Unknown extension type: unknown_type/)
  })

  test('throws error if trying to generate a extension over the registration limit', async () => {
    // Given
    const themeExtension = await testThemeExtensions()
    await mockSuccessfulCommandExecution('theme_app_extension', [themeExtension])

    // When
    const got = generate({directory: '/', reset: false, config: mockConfig, type: 'theme_app_extension'})

    // Then
    await expect(got).rejects.toThrow(/Invalid extension type/)
  })

  test('throws error if trying to generate a function over the registration limit', async () => {
    // Given
    const discountsFunction = await testFunctionExtension()
    await mockSuccessfulCommandExecution('product_discounts', [discountsFunction])

    // When
    const got = generate({directory: '/', reset: false, config: mockConfig, type: 'product_discounts'})

    // Then
    await expect(got).rejects.toThrow(/Invalid extension type/)
  })

  test('throws error if trying to generate with an unsupported flavor', async () => {
    // Given
    await mockSuccessfulCommandExecution('checkout_ui')

    // When
    const got = generate({
      directory: '/',
      reset: false,
      config: mockConfig,
      type: 'checkout_ui',
      template: 'unknown',
    })

    // Then
    await expect(got).rejects.toThrow(/Invalid template for extension type/)
  })
})

async function mockSuccessfulCommandExecution(identifier: string, existingExtensions: Extension[] = []) {
  const appRoot = '/'
  const app = testApp({
    directory: appRoot,
    configurationPath: joinPath(appRoot, 'shopify.app.toml'),
    extensionsForType: (_spec: {identifier: string; externalIdentifier: string}) => existingExtensions,
    extensions: {
      function: existingExtensions.filter((extension) => extension.type === 'product_discounts') as FunctionExtension[],
      ui: existingExtensions.filter((extension) => extension.type === 'product_subscription') as UIExtension[],
      theme: existingExtensions.filter((extension) => extension.type === 'theme') as ThemeExtension[],
    },
  })

  const allExtensionTemplates = testRemoteExtensionTemplates.concat(testLocalExtensionTemplates)
  const extensionTemplate = allExtensionTemplates.find((spec) => spec.identifier === identifier)!

  vi.mocked(loadApp).mockResolvedValue(app)
  vi.mocked(partnersRequest).mockResolvedValueOnce({extensionSpecifications: testRemoteSpecifications})
  vi.mocked(partnersRequest).mockResolvedValueOnce({templateSpecifications: testRemoteExtensionTemplates})
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
