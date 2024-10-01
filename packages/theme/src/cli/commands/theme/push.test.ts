import Push from './push.js'
import {DevelopmentThemeManager} from '../../utilities/development-theme-manager.js'
import {ensureThemeStore} from '../../utilities/theme-store.js'
import {describe, vi, expect, test} from 'vitest'
import {Config} from '@oclif/core'
import {execCLI2} from '@shopify/cli-kit/node/ruby'
import {ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {buildTheme} from '@shopify/cli-kit/node/themes/factories'

vi.mock('../../services/push.js')
vi.mock('../../utilities/theme-store.js')
vi.mock('../../utilities/theme-selector.js')
vi.mock('../../services/local-storage.js')
vi.mock('@shopify/cli-kit/node/ruby')
vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/themes/api')
vi.mock('@shopify/cli-kit/node/ui')

const CommandConfig = new Config({root: __dirname})

describe('Push', () => {
  const adminSession = {token: '', storeFqdn: ''}
  const path = '/my-theme'

  test('should run the Ruby implementation if the password flag is provided', async () => {
    // Given
    vi.mocked(ensureThemeStore).mockReturnValue('example.myshopify.com')
    vi.mocked(ensureAuthenticatedThemes).mockResolvedValue(adminSession)

    const theme = buildTheme({id: 1, name: 'Theme', role: 'development'})!
    vi.spyOn(DevelopmentThemeManager.prototype, 'fetch').mockResolvedValue(theme)

    // When
    await CommandConfig.load()
    const push = new Push([`--path=${path}`, '--password', '123'], CommandConfig)
    await push.run()

    // Then
    expectCLI2ToHaveBeenCalledWith(`theme push ${path} --development-theme-id ${theme.id}`)
  })

  function expectCLI2ToHaveBeenCalledWith(command: string) {
    expect(execCLI2).toHaveBeenCalledWith(command.split(' '), {
      store: 'example.myshopify.com',
      adminToken: adminSession.token,
    })
  }
})
