import {SHOPIFY_AI_TOOLKIT_PLUGIN_HINT} from '../../../private/node/plugin-hints.js'
import {afterEach, describe, expect, test, vi} from 'vitest'

vi.mock('../output.js', () => ({outputDebug: vi.fn()}))
vi.mock('../../../private/node/analytics.js', () => ({startAnalytics: vi.fn().mockResolvedValue(undefined)}))
vi.mock('../notifications-system.js', () => ({fetchNotificationsInBackground: vi.fn()}))
vi.mock('../../../common/version.js', () => ({CLI_KIT_VERSION: '1.0.0'}))
vi.mock('../version.js', () => ({isPreReleaseVersion: vi.fn().mockReturnValue(true)}))
vi.mock('../node-package-manager.js', () => ({checkForNewVersion: vi.fn()}))
vi.mock('../../../private/node/plugin-hints.js', () => ({
  SHOPIFY_AI_TOOLKIT_PLUGIN_HINT:
    '<claude-code-hint v="1" type="plugin" value="shopify-ai-toolkit@claude-plugins-official" />',
  emitClaudeCodePluginHint: () => {
    if (process.env.CLAUDECODE) process.stderr.write(`${SHOPIFY_AI_TOOLKIT_PLUGIN_HINT}\n`)
  },
}))

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
    const {hook} = await import('./prerun.js')

    await expect((hook as any)(options)).resolves.toBeUndefined()
    expect(stderr).toHaveBeenCalledWith(`${SHOPIFY_AI_TOOLKIT_PLUGIN_HINT}\n`)
  })

  test('completes when the optional emitter module fails to load', async () => {
    vi.resetModules()
    vi.doMock('../../../private/node/plugin-hints.js', () => Promise.reject(new Error('load failed')))
    const {hook} = await import('./prerun.js')

    await expect((hook as any)(options)).resolves.toBeUndefined()
  })
})
