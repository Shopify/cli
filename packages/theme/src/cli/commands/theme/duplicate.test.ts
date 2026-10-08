import Duplicate from './duplicate.js'
import {themeDuplicateJsonOutputSchema} from '../../services/duplicate/types.js'
import {findThemeById} from '../../utilities/theme-selector.js'
import {Config} from '@oclif/core'
import {ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {themeDuplicate} from '@shopify/cli-kit/node/themes/api'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {outputWarn} from '@shopify/cli-kit/node/output'
import {runWithCommandEventsForCommand} from '@shopify/cli-kit/node/command-events'
import {loadEnvironment} from '@shopify/cli-kit/node/environments'
import {afterEach, describe, expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/themes/api')
vi.mock('@shopify/cli-kit/node/environments')
vi.mock('../../utilities/theme-selector.js')

afterEach(() => vi.unstubAllEnvs())

const originalTheme = {id: 1, name: 'Original', role: 'unpublished', processing: false, createdAtRuntime: false}
const copiedTheme = {...originalTheme, id: 2, name: 'Copy'}
const session = {token: 'token', storeFqdn: 'test.myshopify.com'}
const publicResult = {
  status: 'success',
  changed: true,
  originalTheme: {id: '1', name: 'Original', role: 'unpublished'},
  theme: {
    id: '2',
    name: 'Copy',
    role: 'unpublished',
    storeDomain: session.storeFqdn,
    previewUrl: 'https://test.myshopify.com?preview_theme_id=2',
  },
}

async function run(extra: string[] = []) {
  const config = new Config({root: __dirname})
  await config.load()
  vi.mocked(ensureAuthenticatedThemes).mockResolvedValue(session)
  const argv = ['--store', session.storeFqdn, '--theme', '1', '--force', '--json', ...extra]
  await runWithCommandEventsForCommand(argv, () => new Duplicate(argv, config).run())
}

describe('theme duplicate JSON output', () => {
  test('exposes a strict public schema and keeps the JSON flag', () => {
    expect(Duplicate.jsonOutputSchema).toBe(themeDuplicateJsonOutputSchema)
    expect(Duplicate.flags.json).toBeDefined()
    expect(Duplicate.description).toContain('ThemeDuplicateResult')
    expect(themeDuplicateJsonOutputSchema.validate(publicResult)).toEqual(publicResult)
    expect(() =>
      themeDuplicateJsonOutputSchema.validate({...publicResult, theme: {...publicResult.theme, id: 2}}),
    ).toThrow()
    expect(() =>
      themeDuplicateJsonOutputSchema.validate({
        ...publicResult,
        theme: {...publicResult.theme, createdAtRuntime: false},
      }),
    ).toThrow()
  })

  test('writes one receipt to stdout and routes diagnostics to stderr', async () => {
    vi.mocked(findThemeById).mockResolvedValue(originalTheme)
    vi.mocked(themeDuplicate).mockImplementation(async () => {
      outputWarn('Retrying request')
      return {theme: copiedTheme, userErrors: [], requestId: 'omitted-on-success'}
    })
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await run()
      expect(JSON.parse(stdout())).toEqual(publicResult)
      expect(JSON.parse(stderr())).toMatchObject({type: 'diagnostic', level: 'warning', message: 'Retrying request'})
    })
  })

  test.each([undefined, '', 'request-123'])('throws a fatal error with domain details (%s)', async (requestId) => {
    vi.mocked(findThemeById).mockResolvedValue(originalTheme)
    vi.mocked(themeDuplicate).mockResolvedValue({userErrors: [{message: 'Limit reached'}], requestId})
    await withCapturedStandardStreams(async ({stdout}) => {
      await expect(run()).rejects.toMatchObject({
        message: "The theme 'Original' could not be duplicated due to errors",
        details: {errors: ['Limit reached'], ...(requestId ? {requestId} : {})},
      })
      expect(stdout()).toBe('')
    })
  })

  test('reports API errors even when a theme is returned', async () => {
    vi.mocked(findThemeById).mockResolvedValue(originalTheme)
    vi.mocked(themeDuplicate).mockResolvedValue({theme: copiedTheme, userErrors: [{message: 'Duplication failed'}]})
    await withCapturedStandardStreams(async ({stdout}) => {
      await expect(run()).rejects.toMatchObject({details: {errors: ['Duplication failed']}})
      expect(stdout()).toBe('')
    })
  })

  test('fails when the API returned no duplicate', async () => {
    vi.mocked(findThemeById).mockResolvedValue(originalTheme)
    vi.mocked(themeDuplicate).mockResolvedValue({userErrors: []})
    await expect(run()).rejects.toThrow("The theme 'Original' unexpectedly could not be duplicated")
  })

  test('wraps a single explicitly requested environment', async () => {
    vi.mocked(loadEnvironment).mockResolvedValue({store: session.storeFqdn, password: 'token', theme: '1'})
    vi.mocked(findThemeById).mockResolvedValue(originalTheme)
    vi.mocked(themeDuplicate).mockResolvedValue({theme: copiedTheme, userErrors: []})
    await withCapturedStandardStreams(async ({stdout}) => {
      await run(['--environment', 'staging'])
      expect(JSON.parse(stdout())).toEqual({environments: [{environment: 'staging', result: publicResult}]})
    })
  })

  test.each([['staging'], ['staging', 'production']])(
    'does not prompt for CI environments: %j',
    async (...environments) => {
      vi.stubEnv('CI', '1')
      vi.mocked(ensureAuthenticatedThemes).mockResolvedValue(session)
      vi.mocked(loadEnvironment).mockResolvedValue({store: session.storeFqdn, password: 'token', theme: 1})
      vi.mocked(findThemeById).mockResolvedValue(originalTheme)
      vi.mocked(themeDuplicate).mockResolvedValue({theme: copiedTheme, userErrors: []})
      const config = new Config({root: __dirname})
      await config.load()
      const argv = ['--json', ...environments.flatMap((environment) => ['-e', environment])]

      await withCapturedStandardStreams(async ({stdout}) => {
        await runWithCommandEventsForCommand(argv, () => new Duplicate(argv, config).run())
        expect(JSON.parse(stdout())).toEqual({
          environments: environments.map((environment) => ({environment, result: publicResult})),
        })
      })
      expect(themeDuplicate).toHaveBeenCalledTimes(environments.length)
      expect(findThemeById).toHaveBeenCalledWith(session, '1')
    },
  )

  test('reports missing force as an environment error when input is disabled outside CI', async () => {
    vi.stubEnv('CI', '')
    vi.stubEnv('SHOPIFY_FLAG_NO_INPUT', '1')
    vi.mocked(loadEnvironment).mockResolvedValue({store: session.storeFqdn, password: 'token', theme: 1})
    const config = new Config({root: __dirname})
    await config.load()
    const argv = ['--json', '-e', 'staging']
    const previousExitCode = process.exitCode
    try {
      await withCapturedStandardStreams(async ({stdout}) => {
        await runWithCommandEventsForCommand(argv, () => new Duplicate(argv, config).run())

        expect(JSON.parse(stdout())).toMatchObject({
          environments: [{environment: 'staging', error: {type: 'abort', message: expect.stringContaining('--force')}}],
        })
      })
      expect(process.exitCode).toBe(1)
      expect(ensureAuthenticatedThemes).not.toHaveBeenCalled()
      expect(themeDuplicate).not.toHaveBeenCalled()
    } finally {
      process.exitCode = previousExitCode
    }
  })

  test('does not write a result when the API throws', async () => {
    vi.mocked(findThemeById).mockResolvedValue(originalTheme)
    vi.mocked(themeDuplicate).mockRejectedValue(new Error('Network failure'))
    await withCapturedStandardStreams(async ({stdout}) => {
      await expect(run()).rejects.toThrow('Network failure')
      expect(stdout()).toBe('')
    })
  })
})
