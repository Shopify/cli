import {themeExtensionArgs} from './theme-extension-args'
import {AppInterface} from '../../models/app/app'
import {ThemeExtension} from '../../models/app/extensions'
import {ensureDeployEnvironment} from '../environment'
import {beforeAll, describe, expect, it, vi} from 'vitest'

beforeAll(() => {
  vi.mock('../../models/app/app.js')
  vi.mock('../environment.js')
})

describe('themeExtensionArgs', async () => {
  it('returns valid theme extension arguments', async () => {
    const apiKey = 'api_key_0000_1111_2222'
    const app = testApp()
    const reset = false
    const options = {app, reset, port: 8282, theme: 'theme ID'}

    const deployEnvironmentOutput = {
      app: options.app,
      token: 'token',
      partnersOrganizationId: '123',
      partnersApp: {
        id: '456',
        title: 'title',
        organizationId: 'orgID',
      },
      identifiers: {
        app: options.app.name,
        extensions: {},
        extensionIds: {
          'extension title': 'extension ID',
        },
      },
    }

    vi.mocked(ensureDeployEnvironment).mockReturnValue(Promise.resolve(deployEnvironmentOutput))

    const args = await themeExtensionArgs(apiKey, options)

    expect(args).toEqual([
      './my-extension',
      '--api-key',
      'api_key_0000_1111_2222',

      // Extension properties
      '--extension-id',
      'extension ID',
      '--extension-title',
      'extension title',
      '--extension-type',
      'THEME_APP_EXTENSION',

      // Optional properties
      '--theme',
      'theme ID',
      '--port',
      '8282',
    ])
  })
})

export function testApp(): AppInterface {
  return {
    name: 'App',
    idEnvironmentVariableName: 'SHOPIFY_API_KEY',
    directory: '/tmp/project',
    packageManager: 'yarn',
    configuration: {scopes: ''},
    configurationPath: '/tmp/project/shopify.app.toml',
    nodeDependencies: {},
    webs: [],
    extensions: {
      ui: [],
      theme: [testThemeExtensions()],
      function: [],
    },
    hasExtensions: () => true,
    updateDependencies: async () => {},
  }
}

export function testThemeExtensions(): ThemeExtension {
  return {
    configuration: {
      name: 'theme extension name',
      type: 'theme',
    },
    idEnvironmentVariableName: '',
    localIdentifier: 'extension title',
    configurationPath: '',
    directory: './my-extension',
    type: 'theme',
    graphQLType: 'THEME_APP_EXTENSION',
  }
}
