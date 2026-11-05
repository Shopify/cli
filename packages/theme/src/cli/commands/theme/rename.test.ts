import Rename from './rename.js'
import {themeRenameJsonOutputSchema} from '../../services/rename/types.js'
import {themeResultJsonSchema} from '../../services/json-output/schema.test-data.js'
import {findOrSelectTheme} from '../../utilities/theme-selector.js'
import {Config} from '@oclif/core'
import {ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {themeUpdate} from '@shopify/cli-kit/node/themes/api'
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
const renamedTheme = {...originalTheme, name: 'Renamed Theme'}
const store = 'test.myshopify.com'
const publicTheme = {
  id: '1',
  name: 'Renamed Theme',
  role: 'unpublished',
  processing: false,
  storeDomain: store,
  sourceUrl: null,
}

function restoreExitCode(value: typeof process.exitCode): void {
  process.exitCode = value
}

async function run(argv: string[]) {
  const config = new Config({root: __dirname})
  await config.load()
  vi.mocked(ensureAuthenticatedThemes).mockImplementation(async (storeFqdn) => ({token: 'token', storeFqdn}))
  return runWithCommandEventsForCommand(argv, () => new Rename(argv, config).run())
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

describe('theme rename JSON output', () => {
  test.each([undefined, '', 'https://example.com/theme.zip'])(
    'returns the updated theme and nullable source URL (%s)',
    async (src) => {
      vi.mocked(findOrSelectTheme).mockResolvedValue(originalTheme)
      vi.mocked(themeUpdate).mockResolvedValue({...renamedTheme, src})
      await withCapturedStandardStreams(async ({stdout, stderr}) => {
        await run(['--store', store, '--theme', '1', '--name', 'Renamed Theme', '--json'])
        expect(JSON.parse(stdout())).toEqual({
          status: 'success',
          changed: true,
          originalName: 'Original',
          theme: {...publicTheme, sourceUrl: src === '' ? null : (src ?? null)},
        })
        expect(stderr()).toBe('')
      })
    },
  )

  test.each(['none', 'partial', 'all'])('collects one document in configured order (%s failures)', async (failures) => {
    vi.mocked(findOrSelectTheme).mockResolvedValue(originalTheme)
    vi.mocked(themeUpdate).mockImplementation(async (_id, _params, session) => {
      if (failures === 'all' || (failures === 'partial' && session.storeFqdn.startsWith('first.'))) {
        throw new Error('Renameing failed')
      }
      return renamedTheme
    })
    const exitCode = process.exitCode
    await inEnvironments(async () => {
      await withCapturedStandardStreams(async ({stdout, stderr}) => {
        await run([
          '--environment',
          'first',
          '--environment',
          'second',
          '--theme',
          '1',
          '--name',
          'Renamed Theme',
          '--json',
        ])
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
                    originalName: 'Original',
                    theme: {...publicTheme, storeDomain: `${environment}.myshopify.com`},
                  },
                }
              : {environment, error: {type: 'bug', message: 'Renameing failed', stack: expect.any(String)}},
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
    {status: 'success', originalName: 'Original', theme: {...renamedTheme, id: '1', shop: store}},
    {status: 'success', originalName: 'Original', theme: {...renamedTheme, shop: null}},
    {status: 'success', originalName: 'Original', theme: {...renamedTheme, src: false, shop: store}},
    {
      environments: [
        {
          environment: 'first',
          result: {status: 'success', originalName: 'Original', theme: {...renamedTheme, role: null, shop: store}},
        },
      ],
    },
  ])('rejects malformed results %#', (result) => {
    expect(() => themeRenameJsonOutputSchema.validate(result)).toThrow()
  })
})

const renameSession = {token: 'token', storeFqdn: store}

describeJsonCommand({
  command: Rename,
  commandId: 'theme:rename',
  moduleURL: new URL('../../../../../cli/src/index.ts', import.meta.url).href,
  args: ['--store', store, '--theme', '1', '--name', 'Renamed Theme'],
  expectedResult: {
    status: 'success',
    changed: true,
    originalName: 'Original',
    theme: {
      id: '1',
      name: 'Renamed Theme',
      role: 'unpublished',
      storeDomain: store,
      processing: false,
      sourceUrl: null,
    },
  },
  expectedSchema: themeResultJsonSchema,
  setup: () => {
    vi.mocked(ensureAuthenticatedThemes).mockImplementation(async (storeFqdn) => ({token: 'token', storeFqdn}))
    vi.mocked(findOrSelectTheme).mockResolvedValue(originalTheme)
    vi.mocked(themeUpdate).mockResolvedValue(renamedTheme)
  },
  assertExecuted: () => {
    expect(ensureAuthenticatedThemes).toHaveBeenCalledExactlyOnceWith(store, undefined)
    expect(findOrSelectTheme).toHaveBeenCalledExactlyOnceWith(renameSession, {
      header: 'Select a theme to rename',
      filter: expect.objectContaining({theme: '1'}),
    })
    expect(themeUpdate).toHaveBeenCalledExactlyOnceWith(1, {name: 'Renamed Theme'}, renameSession)
  },
  assertNotExecuted: () => {
    expect(ensureAuthenticatedThemes).not.toHaveBeenCalled()
    expect(findOrSelectTheme).not.toHaveBeenCalled()
    expect(themeUpdate).not.toHaveBeenCalled()
  },
  textOutput: ({stdout, stderr}) => {
    expect(stdout).toBe('')
    expect(stderr).toContain("The theme 'Original' (#1) was renamed to 'Renamed Theme'")
  },
  diagnostics: {
    setup: () => {
      vi.mocked(themeUpdate).mockImplementation(async () => {
        outputWarn('Retrying request')
        return renamedTheme
      })
    },
    expectedEvents: [{type: 'diagnostic', level: 'warning', message: 'Retrying request'}],
  },
  failure: {
    setup: () => {
      vi.mocked(themeUpdate).mockRejectedValue(new AbortError('Renaming failed.'))
    },
    expectedError: {error: {type: 'abort', message: 'Renaming failed.'}},
    exitCode: 1,
  },
})
