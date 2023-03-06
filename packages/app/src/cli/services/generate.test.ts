import generate from './generate.js'
import {ensureGenerateContext} from './context.js'
import {load as loadApp} from '../models/app/loader.js'
import generateExtensionPrompt from '../prompts/generate/extension.js'
import generateExtensionService from '../services/generate/extension.js'
import {testApp, testRemoteSpecifications, testThemeExtensions} from '../models/app/app.test-data.js'
import {Extension} from '../models/app/extensions.js'
import {describe, expect, it, vi, beforeAll, afterEach} from 'vitest'
import {Config} from '@oclif/core'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'
import {joinPath} from '@shopify/cli-kit/node/path'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'

vi.mock('../constants.js')
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

describe('after extension command finishes correctly', () => {
  const mockConfig = new Config({root: ''})
  it('displays a confirmation message with instructions to run dev', async () => {
    // Given
    const outputInfo = await mockSuccessfulCommandExecution('checkout_ui_extension_external')

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

  it('displays a confirmation message for a theme app extension', async () => {
    // Given
    const outputInfo = await mockSuccessfulCommandExecution('theme')

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

  it('displays a confirmation message for a function', async () => {
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
      │    • For more details, see the docs (                                        │
      │      https://shopify.dev/docs/apps/discounts )                               │
      │                                                                              │
      ╰──────────────────────────────────────────────────────────────────────────────╯
      "
    `)
  })

  it('throws error if trying to generate a non existing type', async () => {
    // Given
    await mockSuccessfulCommandExecution('unknown_type')

    // When
    const got = generate({directory: '/', reset: false, config: mockConfig, type: 'unknown_type'})

    // Then
    await expect(got).rejects.toThrow(/Unknown extension type: unknown_type/)
  })

  it('throws error if trying to generate a type over the registration limit', async () => {
    // Given
    const themeExtension = await testThemeExtensions()
    await mockSuccessfulCommandExecution('theme', [themeExtension])

    // When
    const got = generate({directory: '/', reset: false, config: mockConfig, type: 'theme'})

    // Then
    await expect(got).rejects.toThrow(/Invalid extension type/)
  })

  it('throws error if trying to generate with an unsupported flavor', async () => {
    // Given
    await mockSuccessfulCommandExecution('checkout_ui_extension_external')

    // When
    const got = generate({
      directory: '/',
      reset: false,
      config: mockConfig,
      type: 'checkout_ui_extension_external',
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
    extensionsForType: (spec: {identifier: string; externalIdentifier: string}) => existingExtensions,
  })

  vi.mocked(loadApp).mockResolvedValue(app)
  vi.mocked(partnersRequest).mockResolvedValueOnce({extensionSpecifications: testRemoteSpecifications})
  vi.mocked(ensureGenerateContext).mockResolvedValue('api-key')
  vi.mocked(generateExtensionPrompt).mockResolvedValue({name: 'name', extensionType: identifier})
  vi.mocked(generateExtensionService).mockResolvedValue(joinPath('extensions', 'name'))
  return mockAndCaptureOutput()
}
