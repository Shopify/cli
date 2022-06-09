/* eslint-disable no-irregular-whitespace */
import AppScaffoldExtension from './extension'
import {ExtensionTypesHumanKeys, getExtensionOutputConfig} from '../../../constants'
import {App, load as loadApp} from '../../../models/app/app'
import scaffoldExtensionPrompt from '../../../prompts/scaffold/extension'
import scaffoldExtensionService from '../../../services/scaffold/extension'
import {describe, expect, it, vi, beforeAll} from 'vitest'
import {path} from '@shopify/cli-kit'
import {outputMocker} from '@shopify/cli-testing'

beforeAll(() => {
  vi.mock('../../../constants')
  vi.mock('../../../models/app/app')
  vi.mock('../../../prompts/scaffold/extension')
  vi.mock('../../../services/scaffold/extension')
})

describe('after extension command finishes correctly', () => {
  it('displays a confirmation message with only the human-facing name', async () => {
    // Given
    const outputInfo = mockSuccessfulCommandExecution({
      humanKey: 'checkout UI',
    })

    // When
    await AppScaffoldExtension.run()

    // Then
    expect(outputInfo.info()).toMatchInlineSnapshot('"Find your checkout UI extension in your extensions folder."')
  })

  it('displays a confirmation message with human-facing name and help url', async () => {
    // Given
    const outputInfo = mockSuccessfulCommandExecution({
      humanKey: 'checkout UI',
      helpURL: 'http://help.com',
    })

    // When
    await AppScaffoldExtension.run()

    // Then

    expect(outputInfo.info()).toMatchInlineSnapshot(
      `
      "Find your checkout UI extension in your extensions folder.
      For help, see docs (​http://help.com​)."
    `,
    )
  })

  it('displays a confirmation message with human-facing name and additional help', async () => {
    // Given
    const outputInfo = mockSuccessfulCommandExecution({
      humanKey: 'checkout UI',
      additionalHelp: 'Additional help',
    })

    // When
    await AppScaffoldExtension.run()

    // Then
    expect(outputInfo.info()).toMatchInlineSnapshot(`
      "Find your checkout UI extension in your extensions folder.
      Additional help"
    `)
  })

  it('displays a confirmation message with human-facing name , help url and additional help', async () => {
    // Given
    const outputInfo = mockSuccessfulCommandExecution({
      humanKey: 'checkout UI',
      helpURL: 'http://help.com',
      additionalHelp: 'Additional help',
    })

    // When
    await AppScaffoldExtension.run()

    // Then
    expect(outputInfo.info()).toMatchInlineSnapshot(`
      "Find your checkout UI extension in your extensions folder.
      Additional help
      For help, see docs (​http://help.com​)."
    `)
  })
})

function mockSuccessfulCommandExecution(outputConfig: {
  humanKey: ExtensionTypesHumanKeys
  helpURL?: string
  additionalHelp?: string
}) {
  const appRoot = '/'
  const app: App = {
    name: 'myapp',
    idEnvironmentVariableName: 'SHOPIFY_APP_ID',
    directory: appRoot,
    dependencyManager: 'yarn',
    configurationPath: path.join(appRoot, 'shopify.app.toml'),
    configuration: {
      scopes: '',
    },
    webs: [],
    nodeDependencies: {},
    environment: {
      dotenv: {},
      env: {},
    },
    extensions: {ui: [], function: [], theme: []},
  }

  vi.mocked(getExtensionOutputConfig).mockReturnValue(outputConfig)
  vi.mocked(loadApp).mockResolvedValue(app)
  vi.mocked(scaffoldExtensionPrompt).mockResolvedValue({name: 'name', extensionType: 'theme'})
  vi.mocked(scaffoldExtensionService).mockResolvedValue()

  return outputMocker.mockAndCapture()
}
