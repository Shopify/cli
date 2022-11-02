import {themeExtensionArgs} from './theme-extension-args.js'
import {ensureThemeExtensionDevEnvironment} from '../environment.js'
import {testThemeExtensions} from '../../models/app/app.test-data.js'
import {beforeAll, describe, expect, it, vi} from 'vitest'

beforeAll(() => {
  vi.mock('../../models/app/app.js')
  vi.mock('../environment.js')
})

describe('themeExtensionArgs', async () => {
  it('returns valid theme extension arguments', async () => {
    const apiKey = 'api_key_0000_1111_2222'
    const token = 'token'
    const options = {themeExtensionPort: 8282, theme: 'theme ID'}
    const extension = testThemeExtensions()

    const registration = {
      id: 'extension ID',
      uuid: 'UUID',
      type: 'THEME_APP_EXTENSION',
      title: 'theme app extension',
    }

    vi.mocked(ensureThemeExtensionDevEnvironment).mockReturnValue(Promise.resolve(registration))

    const args = await themeExtensionArgs(extension, apiKey, token, options)

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
