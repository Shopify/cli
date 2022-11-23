/* eslint-disable no-irregular-whitespace */
import AppScaffoldExtension from './extension.js'
import {ExternalExtensionTypeNames, getExtensionOutputConfig, isThemeExtensionType} from '../../../constants.js'
import {load as loadApp} from '../../../models/app/loader.js'
import generateExtensionPrompt from '../../../prompts/generate/extension.js'
import generateExtensionService from '../../../services/generate/extension.js'
import {testApp} from '../../../models/app/app.test-data.js'
import {ensureGenerateEnvironment} from '../../../services/environment.js'
import {fetchExtensionSpecifications} from '../../../utilities/extensions/fetch-extension-specifications.js'
import {describe, expect, it, vi, beforeAll, afterEach} from 'vitest'
import {path, outputMocker} from '@shopify/cli-kit'

beforeAll(() => {
  vi.mock('../../../constants.js')
  vi.mock('../../../models/app/loader.js')
  vi.mock('../../../prompts/generate/extension.js')
  vi.mock('../../../services/generate/extension.js')
  vi.mock('../../../services/environment.js')
  vi.mock('../../../utilities/extensions/fetch-extension-specifications.js')
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
  it('displays a confirmation message with only the human-facing name', async () => {
    // Given
    const outputInfo = mockSuccessfulCommandExecution({
      humanKey: 'Checkout UI',
    })

    // When
    await AppScaffoldExtension.run()

    // Then
    expect(outputInfo.completed()).toMatchInlineSnapshot('"Your Checkout UI extension was added to your project!"')
    expect(outputInfo.info()).toMatchInlineSnapshot('"\n  To find your extension, remember to cd extensions/name\n"')
  })

  it('displays a confirmation message with human-facing name and help url when app has a checkout UI extension', async () => {
    // Given
    const outputInfo = mockSuccessfulCommandExecution({
      humanKey: 'Checkout UI',
      helpURL: 'http://help.com',
    })

    // When
    await AppScaffoldExtension.run()

    // Then

    expect(outputInfo.completed()).toMatchInlineSnapshot('"Your Checkout UI extension was added to your project!"')
    expect(outputInfo.info()).toMatchInlineSnapshot(
      `"\n  To find your extension, remember to cd extensions/name\n  For more details, see the docs (​http://help.com​) ✨\n"`,
    )
  })

  it('displays a confirmation message with human-facing name and help url when app has a theme app extension', async () => {
    // Given
    const outputInfo = mockSuccessfulCommandExecution({
      humanKey: 'Theme app extension',
      helpURL: 'http://help.com',
    })
    vi.mocked(isThemeExtensionType).mockReturnValue(true)

    // When
    await AppScaffoldExtension.run()

    // Then
    expect(outputInfo.completed()).toMatchInlineSnapshot(
      '"Your Theme app extension extension was added to your project!"',
    )
    expect(outputInfo.info()).toMatchInlineSnapshot(
      '"\n  To find your extension, remember to cd extensions/name' +
        '\n  To preview your project, run yarn dev' +
        '\n  For more details, see the docs (​http://help.com​) ✨\n"',
    )
  })

  it('displays a confirmation message with human-facing name and additional help', async () => {
    // Given
    const outputInfo = mockSuccessfulCommandExecution({
      humanKey: 'Checkout UI',
      additionalHelp: 'Additional help',
    })

    // When
    await AppScaffoldExtension.run()

    // Then
    expect(outputInfo.completed()).toMatchInlineSnapshot('"Your Checkout UI extension was added to your project!"')
    expect(outputInfo.info()).toMatchInlineSnapshot(
      `"\n  To find your extension, remember to cd extensions/name\n  Additional help\n"`,
    )
  })

  it('displays a confirmation message with human-facing name , help url and additional help', async () => {
    // Given
    const outputInfo = mockSuccessfulCommandExecution({
      humanKey: 'Checkout UI',
      helpURL: 'http://help.com',
      additionalHelp: 'Additional help',
    })

    // When
    await AppScaffoldExtension.run()

    // Then
    expect(outputInfo.completed()).toMatchInlineSnapshot('"Your Checkout UI extension was added to your project!"')
    expect(outputInfo.info()).toMatchInlineSnapshot(
      `"\n  To find your extension, remember to cd extensions/name\n  Additional help\n  For more details, see the docs (​http://help.com​) ✨\n"`,
    )
  })
})

function mockSuccessfulCommandExecution(outputConfig: {
  humanKey: ExternalExtensionTypeNames
  helpURL?: string
  additionalHelp?: string
}) {
  const appRoot = '/'
  const app = testApp({directory: appRoot, configurationPath: path.join(appRoot, 'shopify.app.toml')})

  vi.mocked(getExtensionOutputConfig).mockReturnValue(outputConfig)
  vi.mocked(loadApp).mockResolvedValue(app)
  vi.mocked(ensureGenerateEnvironment).mockResolvedValue('api-key')
  vi.mocked(fetchExtensionSpecifications).mockResolvedValue([])
  vi.mocked(generateExtensionPrompt).mockResolvedValue({name: 'name', extensionType: 'theme'})
  vi.mocked(generateExtensionService).mockResolvedValue(path.join(appRoot, 'extensions', 'name'))

  return outputMocker.mockAndCaptureOutput()
}
