import Dev from './dev.js'
import {loadThemeProjectTrust} from '../../utilities/theme-airlock/config.js'
import {ThemeAirlockError} from '../../utilities/theme-airlock/types.js'
import {ensureThemeStore} from '../../utilities/theme-store.js'
import {dev} from '../../services/dev.js'
import {metafieldsPull} from '../../services/metafields-pull.js'
import {setThemeStore} from '../../services/local-storage.js'
import {findOrSelectTheme} from '../../utilities/theme-selector.js'
import {ensureLiveThemeConfirmed} from '../../utilities/theme-ui.js'
import {Config} from '@oclif/core'
import {ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {renderConcurrent} from '@shopify/cli-kit/node/ui'
import {beforeEach, describe, expect, test, vi} from 'vitest'

const setThemeStoreMock = vi.hoisted(() => vi.fn())
const findOrCreate = vi.hoisted(() => vi.fn())
const developmentThemeManagerConstructor = vi.hoisted(() => vi.fn())

vi.mock('../../utilities/theme-airlock/config.js')
vi.mock('../../utilities/theme-store.js')
vi.mock('../../services/dev.js')
vi.mock('../../services/metafields-pull.js')
vi.mock('../../utilities/theme-selector.js')
vi.mock('../../utilities/theme-ui.js')
vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/ui')
vi.mock('../../utilities/development-theme-manager.js', () => ({
  DevelopmentThemeManager: developmentThemeManagerConstructor,
}))
vi.mock('../../services/local-storage.js', async () => {
  const actual = await vi.importActual<typeof import('../../services/local-storage.js')>(
    '../../services/local-storage.js',
  )
  return {...actual, setThemeStore: setThemeStoreMock}
})

const CommandConfig = new Config({root: __dirname})
const adminSession = {token: 'test-token', storeFqdn: 'test-store.myshopify.com'}

async function run() {
  await CommandConfig.load()
  const command = new Dev(['--store=test-store.myshopify.com'], CommandConfig)
  return command.run()
}

describe('theme dev', () => {
  beforeEach(() => {
    developmentThemeManagerConstructor.mockImplementation(() => ({findOrCreate}))
    findOrCreate.mockResolvedValue({id: 1, createdAtRuntime: false})
    vi.mocked(loadThemeProjectTrust).mockRejectedValue(
      new ThemeAirlockError('Theme project trust is blocked', 'unconfigured-project'),
    )
    vi.mocked(ensureThemeStore).mockReturnValue(adminSession.storeFqdn)
    vi.mocked(ensureAuthenticatedThemes).mockResolvedValue(adminSession)
    vi.mocked(findOrSelectTheme).mockResolvedValue({id: 1} as never)
    vi.mocked(ensureLiveThemeConfirmed).mockResolvedValue(true)
    vi.mocked(dev).mockResolvedValue(undefined)
    vi.mocked(metafieldsPull).mockResolvedValue(undefined)
  })

  test('blocks before development lifecycle', async () => {
    await expect(run()).rejects.toMatchObject({reason: 'unconfigured-project'})

    expect(loadThemeProjectTrust).toHaveBeenCalledOnce()
    expect(ensureAuthenticatedThemes).not.toHaveBeenCalled()
    expect(ensureThemeStore).not.toHaveBeenCalled()
    expect(setThemeStore).not.toHaveBeenCalled()
    expect(dev).not.toHaveBeenCalled()
    expect(findOrSelectTheme).not.toHaveBeenCalled()
    expect(developmentThemeManagerConstructor).not.toHaveBeenCalled()
    expect(findOrCreate).not.toHaveBeenCalled()
    expect(ensureLiveThemeConfirmed).not.toHaveBeenCalled()
    expect(metafieldsPull).not.toHaveBeenCalled()
    expect(renderConcurrent).not.toHaveBeenCalled()
  })
})
