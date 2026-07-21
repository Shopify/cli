import Push from './push.js'
import {loadThemeProjectTrust} from '../../utilities/theme-airlock/config.js'
import {ThemeAirlockError} from '../../utilities/theme-airlock/types.js'
import {ensureThemeStore} from '../../utilities/theme-store.js'
import {push} from '../../services/push.js'
import {setThemeStore} from '../../services/local-storage.js'
import {Config} from '@oclif/core'
import {ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {renderConcurrent} from '@shopify/cli-kit/node/ui'
import {beforeEach, describe, expect, test, vi} from 'vitest'

const setThemeStoreMock = vi.hoisted(() => vi.fn())

vi.mock('../../utilities/theme-airlock/config.js')
vi.mock('../../utilities/theme-store.js')
vi.mock('../../services/push.js')
vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/ui')
vi.mock('../../services/local-storage.js', async () => {
  const actual = await vi.importActual<typeof import('../../services/local-storage.js')>(
    '../../services/local-storage.js',
  )
  return {...actual, setThemeStore: setThemeStoreMock}
})

const CommandConfig = new Config({root: __dirname})
const adminSession = {token: 'test-token', storeFqdn: 'test-store.myshopify.com'}

async function run(args: string[]) {
  await CommandConfig.load()
  const command = new Push(['--store=test-store.myshopify.com', ...args], CommandConfig)
  return command.run()
}

describe('theme push', () => {
  beforeEach(() => {
    vi.mocked(loadThemeProjectTrust).mockRejectedValue(
      new ThemeAirlockError('Theme project trust is blocked', 'unconfigured-project'),
    )
    vi.mocked(ensureThemeStore).mockReturnValue(adminSession.storeFqdn)
    vi.mocked(ensureAuthenticatedThemes).mockResolvedValue(adminSession)
    vi.mocked(push).mockResolvedValue(undefined)
  })

  test.each([
    {name: 'without force', args: []},
    {name: 'with force', args: ['--force']},
  ])('blocks before upload lifecycle $name', async ({args}) => {
    await expect(run(args)).rejects.toMatchObject({reason: 'unconfigured-project'})

    expect(loadThemeProjectTrust).toHaveBeenCalledOnce()
    expect(ensureAuthenticatedThemes).not.toHaveBeenCalled()
    expect(ensureThemeStore).not.toHaveBeenCalled()
    expect(setThemeStore).not.toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
    expect(renderConcurrent).not.toHaveBeenCalled()
  })
})
