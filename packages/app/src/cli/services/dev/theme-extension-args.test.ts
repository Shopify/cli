import {themeExtensionArgs} from './theme-extension-args.js'
import {ensureThemeExtensionDevContext} from '../context.js'
import {testThemeExtensions} from '../../models/app/app.test-data.js'
import {describe, expect, vi, test} from 'vitest'

vi.mock('../../models/app/app.js')
vi.mock('../context.js')

describe('themeExtensionArgs', async () => {
  test('returns valid theme extension arguments', async () => {
    const apiKey = 'api_key_0000_1111_2222'
    const token = 'token'
    const options = {themeExtensionPort: 8282, theme: 'theme ID'}
    const extension = await testThemeExtensions()

    const registration = {
      id: 'extension ID',
      uuid: 'UUID',
      type: 'THEME_APP_EXTENSION',
      title: 'theme app extension',
    }

    vi.mocked(ensureThemeExtensionDevContext).mockReturnValue(Promise.resolve(registration))

    const args = await themeExtensionArgs(extension, apiKey, token, options)

    expect(args).toEqual([
      './my-extension',
      '--api-key',
      'api_key_0000_1111_2222',

      // Extension properties
      '--extension-id',
      'extension ID',
      '--extension-title',
      'theme-extension-name',
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
