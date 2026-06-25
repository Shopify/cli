import Dev from './dev.js'
import {dev} from '../../services/dev.js'
import {devServe} from '../../services/dev/local/dev-serve.js'
import {findOrSelectTheme} from '../../utilities/theme-selector.js'
import {ensureLiveThemeConfirmed} from '../../utilities/theme-ui.js'
import {metafieldsPull} from '../../services/metafields-pull.js'
import {buildTheme} from '@shopify/cli-kit/node/themes/factories'
import {Config} from '@oclif/core'
import {beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('../../services/dev.js')
vi.mock('../../services/dev/local/dev-serve.js')
vi.mock('../../services/metafields-pull.js')
vi.mock('../../utilities/theme-selector.js')
vi.mock('../../utilities/theme-ui.js')

const theme = buildTheme({id: 123, name: 'dev-theme', role: 'development'})!
const adminSession = {token: 'token', storeFqdn: 'store.myshopify.com'}

/* Drive the `--theme` branch so the test resolves the theme through the easily
   mocked `findOrSelectTheme` function rather than the DevelopmentThemeManager
   class. */
function devFlags(overrides: Record<string, unknown> = {}) {
  return {
    path: '/my-theme',
    store: 'store.myshopify.com',
    theme: '123',
    'allow-live': false,
    open: false,
    nodelete: false,
    'live-reload': 'hot-reload',
    'error-overlay': 'default',
    'theme-editor-sync': false,
    'standard-events-inspector': false,
    force: false,
    ...overrides,
  }
}

describe('Dev command routing', () => {
  beforeEach(() => {
    vi.mocked(findOrSelectTheme).mockResolvedValue(theme)
    vi.mocked(ensureLiveThemeConfirmed).mockResolvedValue(true)
    vi.mocked(metafieldsPull).mockResolvedValue(undefined as never)
  })

  async function runCommand(flags: Record<string, unknown>) {
    const command = new Dev([], new Config({root: __dirname}))
    /* The Dev subclass narrows `command`'s flags to its inferred flag type;
       the test builds a representative subset, so cast at the call boundary. */
    await command.command(flags as Parameters<Dev['command']>[0], adminSession)
  }

  test('routes to devServe (not dev) when live-reload is local-hot-reload', async () => {
    // When
    await runCommand(devFlags({'live-reload': 'local-hot-reload'}))

    // Then
    expect(devServe).toHaveBeenCalledOnce()
    expect(dev).not.toHaveBeenCalled()
    expect(metafieldsPull).not.toHaveBeenCalled()
  })

  test('routes to dev (not devServe) for the default live-reload value', async () => {
    // When
    await runCommand(devFlags({'live-reload': 'hot-reload'}))

    // Then
    expect(dev).toHaveBeenCalledOnce()
    expect(devServe).not.toHaveBeenCalled()
  })
})
