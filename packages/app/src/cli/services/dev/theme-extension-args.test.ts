import {themeExtensionArgs} from './theme-extension-args'
import {ensureDeployEnvironment} from '../environment'
import {testApp, testThemeExtensions} from '../../models/app/app.test-data'
import {beforeAll, describe, expect, it, vi} from 'vitest'

beforeAll(() => {
  vi.mock('../../models/app/app.js')
  vi.mock('../environment.js')
})

describe('themeExtensionArgs', async () => {
  it('returns valid theme extension arguments', async () => {
    const apiKey = 'api_key_0000_1111_2222'
    const reset = false
    const options = {app: testApp(), reset, themeExtensionPort: 8282, theme: 'theme ID'}
    const extension = testThemeExtensions()

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

    const args = await themeExtensionArgs(extension, apiKey, options)

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
