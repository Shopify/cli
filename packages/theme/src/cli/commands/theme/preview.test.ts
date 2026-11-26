import Preview from './preview.js'
import {themePreviewJsonOutputSchema} from '../../services/dev-override/types.js'
import {devWithOverrideFile} from '../../services/dev-override.js'
import {findOrSelectTheme} from '../../utilities/theme-selector.js'
import {ensureThemeStore} from '../../utilities/theme-store.js'
import {openURL} from '@shopify/cli-kit/node/system'
import {runWithCommandEventsForCommand} from '@shopify/cli-kit/node/command-events'
import {renderSuccess, renderWarning} from '@shopify/cli-kit/node/ui'
import {buildTheme} from '@shopify/cli-kit/node/themes/factories'
import {recordEvent} from '@shopify/cli-kit/node/analytics'
import {ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {Config} from '@oclif/core'
import {inTemporaryDirectory, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {describe, vi, expect, test, beforeEach} from 'vitest'

vi.mock('@shopify/cli-kit/node/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shopify/cli-kit/node/ui')>()
  return {...actual, renderSuccess: vi.fn(), renderWarning: vi.fn(actual.renderWarning)}
})
vi.mock('@shopify/cli-kit/node/system', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/system')>()),
  openURL: vi.fn(),
}))
vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/analytics', () => ({
  recordEvent: vi.fn(),
  compileData: vi.fn().mockReturnValue({timings: {}, errors: {}, retries: {}, events: {}}),
}))
vi.mock('@shopify/cli-kit/node/metadata', () => ({
  addPublicMetadata: vi.fn(),
  addSensitiveMetadata: vi.fn(),
}))
vi.mock('@shopify/cli-kit/node/environments')
vi.mock('../../services/dev-override.js')
vi.mock('../../utilities/theme-selector.js')
vi.mock('../../utilities/theme-store.js')

const CommandConfig = new Config({root: __dirname})

const result = {url: 'https://abc123.shopifypreview.com', preview_identifier: 'abc123'}

const adminSession = {token: 'test-token', storeFqdn: 'test-store.myshopify.com'}
const namedTheme = buildTheme({id: 2, name: 'My Theme', role: 'unpublished'})!

async function run(argv: string[]) {
  await CommandConfig.load()
  const command = new Preview(['--store=test-store.myshopify.com', ...argv], CommandConfig)
  await command.run()
}

describe('Preview', () => {
  beforeEach(() => {
    vi.mocked(ensureThemeStore).mockReturnValue('test-store.myshopify.com')
    vi.mocked(ensureAuthenticatedThemes).mockResolvedValue(adminSession)
    vi.mocked(findOrSelectTheme).mockResolvedValue(namedTheme)
    vi.mocked(devWithOverrideFile).mockResolvedValue(result)
  })

  test.each(['default', 'staging'].flatMap((environment) => [false, true].map((json) => ({environment, json}))))(
    'uses the remembered store for the $environment environment with json=$json',
    async ({environment, json}) => {
      const environments = await import('@shopify/cli-kit/node/environments')
      const actual = await vi.importActual<typeof environments>('@shopify/cli-kit/node/environments')
      vi.mocked(environments.loadEnvironment).mockImplementation(actual.loadEnvironment)
      vi.mocked(environments.environmentFilePath).mockImplementation(actual.environmentFilePath)
      await inTemporaryDirectory(async (directory) => {
        await writeFile(
          joinPath(directory, 'shopify.theme.toml'),
          `[environments.${environment}]\ntheme = "2"\noverrides = "/path/to/overrides.json"\n`,
        )
        const config = new Config({root: __dirname})
        await config.load()
        const argv = [
          '--path',
          directory,
          ...(environment === 'default' ? [] : ['--environment', environment]),
          ...(json ? ['--json'] : []),
        ]
        await withCapturedStandardStreams(async () => {
          await runWithCommandEventsForCommand(argv, () => new Preview(argv, config).run())
        })
        expect(ensureThemeStore).toHaveBeenCalledWith(expect.objectContaining({store: undefined}))
        expect(ensureAuthenticatedThemes).toHaveBeenCalledWith(adminSession.storeFqdn, undefined)
        expect(devWithOverrideFile).toHaveBeenCalledWith(expect.objectContaining({adminSession, themeId: '2'}))
      })
    },
  )

  test('calls devWithOverrideFile with minimum options passed into the command', async () => {
    const expectedTheme = buildTheme({id: 5, name: 'Expected Theme', role: 'unpublished'})!
    vi.mocked(findOrSelectTheme).mockResolvedValue(expectedTheme)

    await run(['--overrides=/path/to/overrides.json', `--theme=${expectedTheme.id}`])

    expect(devWithOverrideFile).toHaveBeenCalledWith(
      expect.objectContaining({
        adminSession,
        overrideJson: '/path/to/overrides.json',
        themeId: expectedTheme.id.toString(),
      }),
    )
  })

  test('passes --preview-id to devWithOverrideFile when provided', async () => {
    const expectedTheme = buildTheme({id: 5, name: 'Expected Theme', role: 'unpublished'})!
    vi.mocked(findOrSelectTheme).mockResolvedValue(expectedTheme)

    await run(['--overrides=/path/to/overrides.json', `--theme=${expectedTheme.id}`, '--preview-id=abc123'])

    expect(devWithOverrideFile).toHaveBeenCalledWith(
      expect.objectContaining({
        themeId: expectedTheme.id.toString(),
        previewIdentifier: 'abc123',
      }),
    )
  })

  test('opens the resulting preview when requested', async () => {
    vi.mocked(openURL).mockResolvedValue(true)
    const expectedTheme = buildTheme({id: 5, name: 'Expected Theme', role: 'unpublished'})!
    vi.mocked(findOrSelectTheme).mockResolvedValue(expectedTheme)

    await run(['--overrides=/path/to/overrides.json', `--theme=${expectedTheme.id}`, '--open'])

    expect(openURL).toHaveBeenCalledWith(result.url)

    expect(devWithOverrideFile).toHaveBeenCalledWith(
      expect.objectContaining({
        themeId: expectedTheme.id.toString(),
      }),
    )
  })

  test('records the preview authenticated event', async () => {
    const expectedTheme = buildTheme({id: 5, name: 'Expected Theme', role: 'unpublished'})!
    vi.mocked(findOrSelectTheme).mockResolvedValue(expectedTheme)

    await run(['--overrides=/path/to/overrides.json', `--theme=${expectedTheme.id}`])

    expect(recordEvent).toHaveBeenCalledWith('theme-command:preview:single-env:authenticated')
  })

  test('passes --password to devWithOverrideFile when provided', async () => {
    const expectedTheme = buildTheme({id: 5, name: 'Expected Theme', role: 'unpublished'})!
    vi.mocked(findOrSelectTheme).mockResolvedValue(expectedTheme)

    await run(['--overrides=/path/to/overrides.json', `--theme=${expectedTheme.id}`, '--password=shptka_abc123'])

    expect(devWithOverrideFile).toHaveBeenCalledWith(
      expect.objectContaining({
        themeId: expectedTheme.id.toString(),
        password: 'shptka_abc123',
      }),
    )
  })

  test('writes the JSON result to stdout through the real presenter and writer', async () => {
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await runWithCommandEventsForCommand(['--json'], () =>
        run(['--overrides=/path/to/overrides.json', '--theme=2', '--json']),
      )

      expect(JSON.parse(stdout())).toEqual({
        status: 'success',
        preview: {id: result.preview_identifier, url: result.url},
      })
      expect(stderr()).toBe('')
    })
    expect(renderSuccess).not.toHaveBeenCalled()
    expect(openURL).not.toHaveBeenCalled()
    expect(devWithOverrideFile).toHaveBeenCalledWith({
      adminSession,
      overrideJson: '/path/to/overrides.json',
      themeId: '2',
      previewIdentifier: undefined,
      password: undefined,
    })
  })

  test('exposes its result schema in help', () => {
    expect(Preview.jsonOutputSchema).toBe(themePreviewJsonOutputSchema)
    expect(Preview.description).toContain('ThemePreviewResult')
    expect(Preview.description).toContain('ThemePreview')
    expect(Preview.flags.json.env).toBe('SHOPIFY_FLAG_JSON')
  })

  test('propagates failures without printing a success result or opening a browser', async () => {
    const error = new Error('Failed to parse override file')
    vi.mocked(devWithOverrideFile).mockRejectedValue(error)

    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await expect(run(['--overrides=/path/to/overrides.json', '--theme=2', '--json', '--open'])).rejects.toBe(error)

      expect(stdout()).toBe('')
      expect(stderr()).toBe('')
    })

    expect(renderSuccess).not.toHaveBeenCalled()
    expect(openURL).not.toHaveBeenCalled()
  })

  test('waits for a slow browser failure before writing the final result', async () => {
    let rejectBrowser: ((error: Error) => void) | undefined
    vi.mocked(openURL).mockImplementation(
      () =>
        new Promise<boolean>((_resolve, reject) => {
          rejectBrowser = reject
        }),
    )
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      const execution = runWithCommandEventsForCommand(['--json'], () =>
        run(['--overrides=/path/to/overrides.json', '--theme=2', '--json', '--open']),
      )
      await vi.waitFor(() => expect(openURL).toHaveBeenCalled())
      expect(stdout()).toBe('')
      rejectBrowser?.(new Error('Browser unavailable'))
      await execution
      expect(JSON.parse(stderr())).toMatchObject({type: 'diagnostic', level: 'warning'})
      expect(JSON.parse(stdout())).toEqual({
        status: 'success',
        preview: {id: result.preview_identifier, url: result.url},
      })
    })
  })

  test('keeps browser failures nonfatal and sends a typed warning to stderr', async () => {
    const error = new Error('Browser unavailable')
    vi.mocked(openURL).mockRejectedValue(error)

    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await runWithCommandEventsForCommand(['--json'], () =>
        run(['--overrides=/path/to/overrides.json', '--theme=2', '--json', '--open']),
      )

      const events = stderr()
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line))
      expect(events).toMatchObject([
        {type: 'diagnostic', level: 'warning', message: `Failed to open theme preview.\n\n${error.stack}`},
      ])
      expect(JSON.parse(stdout())).toEqual({
        status: 'success',
        preview: {id: result.preview_identifier, url: result.url},
      })
    })
  })

  test.each([false, true])('reports the browser open result in JSON diagnostics (opened: %s)', async (opened) => {
    vi.mocked(openURL).mockResolvedValue(opened)

    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await runWithCommandEventsForCommand(['--json'], () =>
        run(['--overrides=/path/to/overrides.json', '--theme=2', '--json', '--open']),
      )

      expect(JSON.parse(stdout())).toEqual({
        status: 'success',
        preview: {id: result.preview_identifier, url: result.url},
      })
      if (opened) {
        expect(stderr()).toBe('')
      } else {
        expect(JSON.parse(stderr())).toMatchObject({
          type: 'diagnostic',
          level: 'warning',
          message: expect.stringContaining(`Open this URL manually: ${result.url}`),
        })
      }
    })
    expect(openURL).toHaveBeenCalledWith(result.url)
  })

  test('warns in text mode when the browser could not be opened', async () => {
    vi.mocked(openURL).mockResolvedValue(false)

    await run(['--overrides=/path/to/overrides.json', '--theme=2', '--open'])

    expect(renderWarning).toHaveBeenCalledWith({
      headline: 'Failed to open theme preview.',
      body: expect.stringContaining(`Open this URL manually: ${result.url}`),
    })
    expect(renderSuccess).toHaveBeenCalledOnce()
  })
})

test('returns one explicit environment result', async () => {
  const {loadEnvironment} = await import('@shopify/cli-kit/node/environments')
  vi.mocked(loadEnvironment).mockResolvedValue({
    store: adminSession.storeFqdn,
    theme: '2',
    overrides: '/path/to/overrides.json',
  })
  vi.mocked(ensureThemeStore).mockReturnValue(adminSession.storeFqdn)
  vi.mocked(ensureAuthenticatedThemes).mockResolvedValue(adminSession)
  vi.mocked(findOrSelectTheme).mockResolvedValue(namedTheme)
  vi.mocked(devWithOverrideFile).mockResolvedValue(result)
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await runWithCommandEventsForCommand(['--json'], () => run(['--environment=staging', '--json']))
    expect(JSON.parse(stdout())).toEqual({
      environments: [
        {
          environment: 'staging',
          result: {
            status: 'success',
            preview: {id: result.preview_identifier, url: result.url},
          },
        },
      ],
    })
    expect(stderr()).toBe('')
  })
})

test.each([['--theme=2'], ['--overrides=/path/to/overrides.json']])(
  'rejects missing required preview options: %j',
  async (flag) => {
    await expect(run([flag, '--json'])).rejects.toThrow(
      'Specify both --theme and --overrides, either as flags or in an environment.',
    )
    expect(devWithOverrideFile).not.toHaveBeenCalled()
    expect(ensureAuthenticatedThemes).not.toHaveBeenCalled()
  },
)

test.each(['none', 'validation', 'store', 'execution'])(
  'retains every preview environment with %s failures',
  async (failure) => {
    const {loadEnvironment} = await import('@shopify/cli-kit/node/environments')
    vi.mocked(loadEnvironment).mockImplementation(async (environment) => ({
      ...(failure === 'store' && environment === 'staging' ? {} : {store: `${environment}.myshopify.com`}),
      password: 'token',
      theme: '2',
      ...(failure === 'validation' && environment === 'staging' ? {} : {overrides: '/path/to/overrides.json'}),
    }))
    vi.mocked(ensureThemeStore).mockImplementation(({store}) => store!)
    vi.mocked(ensureAuthenticatedThemes).mockImplementation(async (storeFqdn) => ({storeFqdn, token: 'token'}))
    vi.mocked(findOrSelectTheme).mockResolvedValue(namedTheme)
    vi.mocked(devWithOverrideFile).mockImplementation(async ({adminSession}) => {
      if (failure === 'execution' && adminSession.storeFqdn === 'staging.myshopify.com') {
        throw new Error('Preview failed')
      }
      return result
    })
    const config = new Config({root: __dirname})
    await config.load()
    const argv = ['--json', '-e', 'staging', '-e', 'production']
    const missingFlag = failure === 'store' ? 'store' : 'overrides'
    const previousExitCode = process.exitCode
    process.exitCode = 0
    try {
      await withCapturedStandardStreams(async ({stdout}) => {
        await runWithCommandEventsForCommand(argv, () => new Preview(argv, config).run())
        expect(JSON.parse(stdout())).toEqual({
          environments: ['staging', 'production'].map((environment) => ({
            environment,
            ...(environment === 'staging' && failure !== 'none'
              ? {
                  error: expect.objectContaining({
                    message: expect.stringContaining(failure === 'execution' ? 'Preview failed' : missingFlag),
                  }),
                }
              : {result: {status: 'success', preview: {id: result.preview_identifier, url: result.url}}}),
          })),
        })
      })
      expect(ensureAuthenticatedThemes).toHaveBeenCalledTimes(['validation', 'store'].includes(failure) ? 1 : 2)
      expect(devWithOverrideFile).toHaveBeenCalledTimes(['validation', 'store'].includes(failure) ? 1 : 2)
      expect(process.exitCode).toBe(failure === 'none' ? 0 : 1)
    } finally {
      process.exitCode = previousExitCode
    }
  },
)

test.each(['theme', 'overrides'])(
  'validates missing %s in a JSON environment before authentication',
  async (missing) => {
    const {loadEnvironment} = await import('@shopify/cli-kit/node/environments')
    vi.mocked(loadEnvironment).mockResolvedValue({
      store: adminSession.storeFqdn,
      ...(missing === 'theme' ? {overrides: '/path/to/overrides.json'} : {theme: '2'}),
    })
    const previousExitCode = process.exitCode
    try {
      await withCapturedStandardStreams(async ({stdout}) => {
        await runWithCommandEventsForCommand(['--json'], () => run(['--environment=staging', '--json']))
        expect(JSON.parse(stdout())).toMatchObject({
          environments: [{environment: 'staging', error: {message: expect.stringContaining(missing)}}],
        })
      })
      expect(process.exitCode).toBe(1)
      expect(ensureAuthenticatedThemes).not.toHaveBeenCalled()
      expect(devWithOverrideFile).not.toHaveBeenCalled()
    } finally {
      process.exitCode = previousExitCode
    }
  },
)
