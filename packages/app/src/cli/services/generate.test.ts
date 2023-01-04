import generate from './generate.js'
import {load as loadApp} from '../models/app/loader.js'
import generateExtensionPrompt from '../prompts/generate/extension.js'
import generateExtensionService from '../services/generate/extension.js'
import {testApp, testRemoteSpecifications, testThemeExtensions} from '../models/app/app.test-data.js'
import {ensureGenerateEnvironment} from '../services/environment.js'
import {Extension} from '../models/app/extensions.js'
import {describe, expect, it, vi, beforeAll, afterEach} from 'vitest'
import {path, outputMocker, api} from '@shopify/cli-kit'
import {Config} from '@oclif/core'

beforeAll(() => {
  vi.mock('../constants.js')
  vi.mock('../models/app/loader.js')
  vi.mock('../prompts/generate/extension.js')
  vi.mock('../services/generate/extension.js')
  vi.mock('../services/environment.js')
  vi.mock('@shopify/cli-kit', async () => {
    const cliKit: any = await vi.importActual('@shopify/cli-kit')
    return {
      ...cliKit,
      session: {
        ensureAuthenticatedPartners: () => 'token',
      },
      api: {
        partners: {
          request: vi.fn(),
        },
        graphql: cliKit.api.graphql,
      },
      store: {
        getAppInfo: vi.fn(),
        setAppInfo: vi.fn(),
        clearAppInfo: vi.fn(),
      },
    }
  })
})

afterEach(() => {
  outputMocker.mockAndCaptureOutput().clear()
})

describe('after extension command finishes correctly', () => {
  const mockConfig = new Config({root: ''})
  it('displays a confirmation message with instructions to run dev', async () => {
    // Given
    const outputInfo = await mockSuccessfulCommandExecution('checkout_ui')

    // When
    await generate({directory: '/', reset: false, config: mockConfig})

    // Then
    expect(outputInfo.completed()).toMatchInlineSnapshot('"Your Checkout UI extension was added to your project!"')
    expect(outputInfo.info()).toMatchInlineSnapshot(
      '"\n  To find your extension, remember to cd extensions/name\n  To preview your project, run yarn dev\n"',
    )
  })

  it('displays a confirmation message for a theme app extension', async () => {
    // Given
    const outputInfo = await mockSuccessfulCommandExecution('theme')

    // When
    await generate({directory: '/', reset: false, config: mockConfig})

    // Then
    expect(outputInfo.completed()).toMatchInlineSnapshot(
      '"Your Theme App Extension extension was added to your project!"',
    )
    expect(outputInfo.info()).toMatchInlineSnapshot(
      '"\n  To find your extension, remember to cd extensions/name\n  To preview your project, run yarn dev\n"',
    )
  })

  it('displays a confirmation message for a function', async () => {
    // Given
    const outputInfo = await mockSuccessfulCommandExecution('product_discounts')

    // When
    await generate({directory: '/', reset: false, config: mockConfig})

    // Then
    expect(outputInfo.completed()).toMatchInlineSnapshot(
      '"Your Function - Product discount extension was added to your project!"',
    )
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
    await mockSuccessfulCommandExecution('checkout_ui')

    // When
    const got = generate({directory: '/', reset: false, config: mockConfig, type: 'checkout_ui', template: 'unknown'})

    // Then
    await expect(got).rejects.toThrow(/Invalid template for extension type/)
  })
})

async function mockSuccessfulCommandExecution(identifier: string, existingExtensions: Extension[] = []) {
  const appRoot = '/'
  const app = testApp({
    directory: appRoot,
    configurationPath: path.join(appRoot, 'shopify.app.toml'),
    extensionsForType: (spec: {identifier: string; externalIdentifier: string}) => existingExtensions,
  })

  vi.mocked(loadApp).mockResolvedValue(app)
  vi.mocked(api.partners.request).mockResolvedValueOnce({extensionSpecifications: testRemoteSpecifications})
  vi.mocked(ensureGenerateEnvironment).mockResolvedValue('api-key')
  vi.mocked(generateExtensionPrompt).mockResolvedValue({name: 'name', extensionType: identifier})
  vi.mocked(generateExtensionService).mockResolvedValue(path.join(appRoot, 'extensions', 'name'))
  return outputMocker.mockAndCaptureOutput()
}
