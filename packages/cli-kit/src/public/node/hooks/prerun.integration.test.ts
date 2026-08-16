import {hook} from './prerun.js'
import {SHOPIFY_AI_TOOLKIT_PLUGIN_HINT} from '../../../private/node/plugin-hints.js'
import {afterEach, describe, expect, test, vi} from 'vitest'

vi.mock('../output.js', () => ({outputDebug: vi.fn()}))
vi.mock('../../../private/node/analytics.js', () => ({startAnalytics: vi.fn().mockResolvedValue(undefined)}))
vi.mock('../notifications-system.js', () => ({fetchNotificationsInBackground: vi.fn()}))
vi.mock('../../../common/version.js', () => ({CLI_KIT_VERSION: '1.0.0'}))
vi.mock('../version.js', () => ({isPreReleaseVersion: vi.fn().mockReturnValue(true)}))
vi.mock('../node-package-manager.js', () => ({checkForNewVersion: vi.fn()}))

const options = {
  Command: {id: 'app:dev', aliases: [], plugin: {alias: '@shopify/cli'}},
  argv: [],
} as any

describe('prerun hook plugin hint integration', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  test('writes the marker to stderr and completes under Claude Code', async () => {
    vi.stubEnv('CLAUDECODE', '1')
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)

    await expect((hook as any)(options)).resolves.toBeUndefined()
    expect(stderr).toHaveBeenCalledWith(`${SHOPIFY_AI_TOOLKIT_PLUGIN_HINT}\n`)
  })

  test('does not write the marker outside Claude Code', async () => {
    vi.stubEnv('CLAUDECODE', '')
    vi.stubEnv('CLAUDE_CODE_CHILD_SESSION', '')
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)

    await expect((hook as any)(options)).resolves.toBeUndefined()
    expect(stderr).not.toHaveBeenCalledWith(`${SHOPIFY_AI_TOOLKIT_PLUGIN_HINT}\n`)
  })
})
