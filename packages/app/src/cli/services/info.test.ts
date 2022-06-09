import {info} from './info'
import {App} from '../models/app/app'
import {describe, it, expect, vi, beforeEach} from 'vitest'
import {path, dependency} from '@shopify/cli-kit'

const currentVersion = '2.2.2'
beforeEach(() => {
  vi.mock('@shopify/cli-kit', async () => {
    const cliKit: any = await vi.importActual('@shopify/cli-kit')
    return {
      ...cliKit,
      dependency: {
        checkForNewVersion: vi.fn(),
        getOutputUpdateCLIReminder: vi.fn(),
      },
    }
  })
})

describe('info', () => {
  it('returns update shopify cli reminder when last version is greater than current version', async () => {
    // Given
    const latestVersion = '2.2.3'
    const app = mockApp()
    vi.mocked(dependency.checkForNewVersion).mockResolvedValue(latestVersion)
    const outputReminder = vi.mocked(dependency.getOutputUpdateCLIReminder).mockReturnValue('CLI reminder')

    // When
    const result = info(app, {format: 'text'})
    // Then
    expect(result).resolves.toMatch('Shopify CLI       2.2.2 \u001b[1m\u001b[91m! CLI reminder\u001b[39m\u001b[22m')
  })

  it('returns update shopify cli reminder when last version lower or equals to current version', async () => {
    // Given
    const app = mockApp()
    vi.mocked(dependency.checkForNewVersion).mockResolvedValue(undefined)
    const outputReminder = vi.mocked(dependency.getOutputUpdateCLIReminder).mockReturnValue('CLI reminder')

    // When
    const result = info(app, {format: 'text'})
    // Then
    expect(result).resolves.toMatch('Shopify CLI       2.2.2')
    expect(result).resolves.not.toMatch(' \u001b[1m\u001b[91m! CLI reminder\u001b[39m\u001b[22m')
  })
})

function mockApp(): App {
  const nodeDependencies: {[key: string]: string} = {}
  nodeDependencies['@shopify/cli'] = currentVersion
  return {
    name: 'myapp',
    idEnvironmentVariableName: 'SHOPIFY_APP_ID',
    directory: '/',
    dependencyManager: 'yarn',
    configurationPath: path.join('/', 'shopify.app.toml'),
    configuration: {
      scopes: '',
    },
    webs: [],
    nodeDependencies,
    environment: {
      dotenv: {},
      env: {},
    },
    extensions: {ui: [], function: [], theme: []},
  }
}
