import Publish from './publish.js'
import {themePublishJsonOutputSchema} from '../../services/publish/types.js'
import {themeResultJsonSchema} from '../../services/json-output/schema.test-data.js'
import {findOrSelectTheme} from '../../utilities/theme-selector.js'
import {Config} from '@oclif/core'
import {ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {themePublish} from '@shopify/cli-kit/node/themes/api'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {runWithCommandEventsForCommand} from '@shopify/cli-kit/node/command-events'
import {inTemporaryDirectory, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {outputWarn} from '@shopify/cli-kit/node/output'
import {AbortError} from '@shopify/cli-kit/node/error'
import {describeJsonCommand} from '@shopify/cli-kit/node/testing/json-command'
import {describe, expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/themes/api')
vi.mock('@shopify/cli-kit/node/metadata')
vi.mock('../../utilities/theme-selector.js')
vi.mock('../../utilities/theme-store.js', () => ({ensureThemeStore: ({store}: {store: string}) => store}))

const originalTheme = {id: 1, name: 'Original', role: 'unpublished', processing: false, createdAtRuntime: false}
const publishedTheme = {...originalTheme, role: 'live'}
const store = 'test.myshopify.com'
const publicTheme = {id: '1', name: 'Original', role: 'live', processing: false, storeDomain: store, sourceUrl: null}

function restoreExitCode(value: typeof process.exitCode): void {
  process.exitCode = value
}

async function run(argv: string[]) {
  const config = new Config({root: __dirname})
  await config.load()
  vi.mocked(ensureAuthenticatedThemes).mockImplementation(async (storeFqdn) => ({token: 'token', storeFqdn}))
  return runWithCommandEventsForCommand(argv, () => new Publish(argv, config).run())
}

async function inEnvironments(run: () => Promise<void>) {
  await inTemporaryDirectory(async (directory) => {
    await writeFile(
      joinPath(directory, 'shopify.theme.toml'),
      `
[environments.first]
store = "first.myshopify.com"
password = "token"
[environments.second]
store = "second.myshopify.com"
password = "token"
`,
    )
    const cwd = vi.spyOn(process, 'cwd').mockReturnValue(directory)
    try {
      await run()
    } finally {
      cwd.mockRestore()
    }
  })
}

describe('theme publish JSON output', () => {
  test.each([undefined, '', 'https://example.com/theme.zip'])(
    'returns the updated theme and nullable source URL (%s)',
    async (src) => {
      vi.mocked(findOrSelectTheme).mockResolvedValue(originalTheme)
      vi.mocked(themePublish).mockResolvedValue({...publishedTheme, src})
      await withCapturedStandardStreams(async ({stdout, stderr}) => {
        await run(['--store', store, '--theme', '1', '--force', '--json'])
        expect(JSON.parse(stdout())).toEqual({
          status: 'success',
          changed: true,
          theme: {...publicTheme, sourceUrl: src === '' ? null : (src ?? null)},
        })
        expect(stderr()).toBe('')
      })
    },
  )

  test('returns changed false for an already-live theme', async () => {
    vi.mocked(findOrSelectTheme).mockResolvedValue(publishedTheme)
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await run(['--store', store, '--theme', '1', '--json', '--no-input', '--force'])
      expect(JSON.parse(stdout())).toEqual({status: 'success', changed: false, theme: publicTheme})
      expect(stderr()).toBe('')
    })
    expect(themePublish).not.toHaveBeenCalled()
  })

  test.each(['none', 'partial', 'all'])('collects one document in configured order (%s failures)', async (failures) => {
    vi.mocked(findOrSelectTheme).mockResolvedValue(originalTheme)
    vi.mocked(themePublish).mockImplementation(async (_id, session) => {
      if (failures === 'all' || (failures === 'partial' && session.storeFqdn.startsWith('first.'))) {
        throw new Error('Publishing failed')
      }
      return publishedTheme
    })
    const exitCode = process.exitCode
    await inEnvironments(async () => {
      await withCapturedStandardStreams(async ({stdout, stderr}) => {
        await run(['--environment', 'first', '--environment', 'second', '--theme', '1', '--force', '--json'])
        const environments: string[] = []
        if (failures === 'none') environments.push('first')
        if (failures !== 'all') environments.push('second')
        expect(JSON.parse(stdout())).toEqual({
          environments: ['first', 'second'].map((environment) =>
            environments.includes(environment)
              ? {
                  environment,
                  result: {
                    status: 'success',
                    changed: true,
                    theme: {...publicTheme, storeDomain: `${environment}.myshopify.com`},
                  },
                }
              : {environment, error: {type: 'bug', message: 'Publishing failed', stack: expect.any(String)}},
          ),
        })
        if (failures === 'none') {
          expect(stderr()).toBe('')
        } else {
          const errors = stderr()
            .trim()
            .split('\n')
            .map((line) => JSON.parse(line))
          expect(errors).toHaveLength(failures === 'all' ? 2 : 1)
          expect(errors[0]).toMatchObject({type: 'diagnostic', level: 'error', code: 'theme-environment-failed'})
        }
        expect(process.exitCode).toBe(failures === 'none' ? exitCode : 1)
        restoreExitCode(exitCode)
      })
    })
  })

  test.each([
    {status: 'success', changed: true, theme: {...publishedTheme, id: '1', shop: store}},
    {status: 'success', changed: true, theme: {...publishedTheme, shop: null}},
    {status: 'success', changed: true, theme: {...publishedTheme, src: false, shop: store}},
    {
      environments: [
        {
          environment: 'first',
          result: {status: 'success', changed: true, theme: {...publishedTheme, role: null, shop: store}},
        },
      ],
    },
  ])('rejects malformed results %#', (result) => {
    expect(() => themePublishJsonOutputSchema.validate(result)).toThrow()
  })
})

const publishSession = {token: 'token', storeFqdn: store}

describeJsonCommand({
  command: Publish,
  commandId: 'theme:publish',
  moduleURL: new URL('../../../../../cli/src/index.ts', import.meta.url).href,
  args: ['--store', store, '--theme', '1', '--force'],
  expectedResult: {
    status: 'success',
    changed: true,
    theme: {id: '1', name: 'Original', role: 'live', storeDomain: store, processing: false, sourceUrl: null},
  },
  expectedSchema: themeResultJsonSchema,
  setup: () => {
    vi.mocked(ensureAuthenticatedThemes).mockImplementation(async (storeFqdn) => ({token: 'token', storeFqdn}))
    vi.mocked(findOrSelectTheme).mockResolvedValue(originalTheme)
    vi.mocked(themePublish).mockResolvedValue(publishedTheme)
  },
  assertExecuted: () => {
    expect(ensureAuthenticatedThemes).toHaveBeenCalledExactlyOnceWith(store, undefined)
    expect(findOrSelectTheme).toHaveBeenCalledExactlyOnceWith(publishSession, {
      header: 'Select a theme to publish',
      filter: {development: false, live: false, theme: '1'},
    })
    expect(themePublish).toHaveBeenCalledExactlyOnceWith(1, publishSession)
  },
  assertNotExecuted: () => {
    expect(ensureAuthenticatedThemes).not.toHaveBeenCalled()
    expect(findOrSelectTheme).not.toHaveBeenCalled()
    expect(themePublish).not.toHaveBeenCalled()
  },
  textOutput: ({stdout, stderr}) => {
    expect(stdout).toBe('')
    expect(stderr).toContain("The theme 'Original' (#1) is now live at")
    expect(stderr).toContain(`https://${store}`)
  },
  diagnostics: {
    setup: () => {
      vi.mocked(themePublish).mockImplementation(async () => {
        outputWarn('Retrying request')
        return publishedTheme
      })
    },
    expectedEvents: [{type: 'diagnostic', level: 'warning', message: 'Retrying request'}],
  },
  failure: {
    setup: () => {
      vi.mocked(themePublish).mockRejectedValue(new AbortError('Publishing failed.'))
    },
    expectedError: {error: {type: 'abort', message: 'Publishing failed.'}},
    exitCode: 1,
  },
})
