import generate from './generate.js'
import {load as loadApp} from '../models/app/loader.js'
import generateExtensionPrompt from '../prompts/generate/extension.js'
import generateExtensionService from '../services/generate/extension.js'
import {testApp, testRemoteSpecifications} from '../models/app/app.test-data.js'
import {ensureGenerateEnvironment} from '../services/environment.js'
import {describe, expect, it, vi, beforeAll, afterEach} from 'vitest'
import {path, outputMocker, api} from '@shopify/cli-kit'

beforeAll(() => {
  vi.mock('../constants.js')
  vi.mock('../models/app/loader.js')
  vi.mock('../prompts/generate/extension.js')
  vi.mock('../services/generate/extension.js')
  // vi.mock('../utilities/extensions/fetch-extension-specifications.js')
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
  it('displays a confirmation message with instructions to run dev', async () => {
    // Given
    const outputInfo = await mockSuccessfulCommandExecution('checkout_ui')

    // When
    await generate({directory: '/', reset: false})

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
    await generate({directory: '/', reset: false})

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
    await generate({directory: '/', reset: false})

    // Then
    expect(outputInfo.completed()).toMatchInlineSnapshot(
      '"Your Function - Product discount extension was added to your project!"',
    )
  })
})

async function mockSuccessfulCommandExecution(identifier: string) {
  const appRoot = '/'
  const app = testApp({directory: appRoot, configurationPath: path.join(appRoot, 'shopify.app.toml')})

  vi.mocked(loadApp).mockResolvedValue(app)
  vi.mocked(api.partners.request).mockResolvedValueOnce({extensionSpecifications: testRemoteSpecifications})
  vi.mocked(ensureGenerateEnvironment).mockResolvedValue('api-key')
  vi.mocked(generateExtensionPrompt).mockResolvedValue({name: 'name', extensionType: identifier})
  vi.mocked(generateExtensionService).mockResolvedValue(path.join(appRoot, 'extensions', 'name'))
  // const specs = await loadLocalExtensionsSpecifications()
  // vi.mocked(fetchSpecifications).mockResolvedValue(specs)

  return outputMocker.mockAndCaptureOutput()
}
