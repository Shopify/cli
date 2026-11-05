import Delete from './delete.js'
import {themeDeleteJsonOutputSchema} from '../../services/delete/types.js'
import {themeResultJsonSchema} from '../../services/json-output/schema.test-data.js'
import {findThemes} from '../../utilities/theme-selector.js'
import * as localStorage from '../../services/local-storage.js'
import {Config} from '@oclif/core'
import {ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {themeDelete} from '@shopify/cli-kit/node/themes/api'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {runWithCommandEventsForCommand} from '@shopify/cli-kit/node/command-events'
import {inTemporaryDirectory, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {outputWarn} from '@shopify/cli-kit/node/output'
import {addSensitiveMetadata} from '@shopify/cli-kit/node/metadata'
import {AbortError} from '@shopify/cli-kit/node/error'
import {describeJsonCommand} from '@shopify/cli-kit/node/testing/json-command'
import {describe, expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/themes/api')
vi.mock('@shopify/cli-kit/node/metadata')
vi.mock('../../utilities/theme-selector.js')
vi.mock('../../utilities/theme-store.js', () => ({ensureThemeStore: ({store}: {store: string}) => store}))

const theme = {id: 1, name: 'Original', role: 'unpublished', processing: false, createdAtRuntime: false}
const store = 'test.myshopify.com'

async function run(argv: string[]) {
  const config = new Config({root: __dirname})
  await config.load()
  vi.mocked(ensureAuthenticatedThemes).mockImplementation(async (storeFqdn) => ({token: 'token', storeFqdn}))
  return runWithCommandEventsForCommand(argv, () => new Delete(argv, config).run())
}

async function inEnvironments(run: () => Promise<void>) {
  await inTemporaryDirectory(async (directory) => {
    await writeFile(
      joinPath(directory, 'shopify.theme.toml'),
      `
[environments.first]
store = "first.myshopify.com"
password = "token"
theme = ["1"]
[environments.second]
store = "second.myshopify.com"
password = "token"
theme = ["2"]
[environments.third]
store = "first.myshopify.com"
password = "token"
theme = ["3"]
[environments.invalid]
store = "invalid.myshopify.com"
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

function restoreExitCode(value: typeof process.exitCode): void {
  process.exitCode = value
}

describe('theme delete JSON output', () => {
  test.each([{themes: []}, {themes: [theme, {...theme, id: 2, src: 'https://example.com/theme.zip'}]}])(
    'writes one complete result without terminal output %#',
    async ({themes}) => {
      vi.mocked(findThemes).mockResolvedValue(themes)
      await withCapturedStandardStreams(async ({stdout, stderr}) => {
        await run(['--store', store, '--theme', '1', '--force', '--json'])
        expect(JSON.parse(stdout())).toEqual({
          status: 'success',
          changed: themes.length > 0,
          themes: themes.map((theme) => ({
            id: String(theme.id),
            name: theme.name,
            role: theme.role,
            processing: theme.processing,
            sourceUrl: ('src' in theme ? theme.src : undefined) ?? null,
            storeDomain: store,
          })),
        })
        expect(stderr()).toBe('')
      })
    },
  )

  test('keeps successful JSON output when development theme cleanup fails', async () => {
    vi.mocked(findThemes).mockResolvedValue([{...theme, role: 'development'}])
    const cleanup = vi.spyOn(localStorage, 'removeDevelopmentTheme').mockImplementation(() => {
      throw new AbortError('Local storage is not writable')
    })
    const exitCode = process.exitCode
    try {
      await withCapturedStandardStreams(async ({stdout, stderr}) => {
        await run(['--store', store, '--theme', '1', '--force', '--json'])

        expect(JSON.parse(stdout())).toMatchObject({status: 'success', changed: true, themes: [{id: '1'}]})
        expect(JSON.parse(stderr())).toMatchObject({
          type: 'diagnostic',
          level: 'warning',
          message: expect.stringContaining('Local storage is not writable'),
        })
        expect(process.exitCode).toBe(exitCode)
      })
    } finally {
      cleanup.mockRestore()
      restoreExitCode(exitCode)
    }
  })

  test.each([false, true])('preserves partial deletions and rejects total failure (partial: %s)', async (partial) => {
    const originalExitCode = process.exitCode
    vi.mocked(findThemes).mockResolvedValue(partial ? [theme, {...theme, id: 2}] : [theme])
    vi.mocked(themeDelete).mockImplementation(async (id) => {
      if (id === 1) throw new Error('Deletion failed')
      return true
    })
    try {
      await withCapturedStandardStreams(async ({stdout}) => {
        const argv = ['--store', store, '--theme', '1', '--force', '--json']
        if (!partial) {
          await expect(run(argv)).rejects.toThrow('Deletion failed')
          expect(stdout()).toBe('')
          return
        }
        await run(argv)
        expect(JSON.parse(stdout())).toEqual({
          status: 'partial',
          changed: true,
          themes: [
            {id: '2', name: theme.name, role: theme.role, storeDomain: store, processing: false, sourceUrl: null},
          ],
          errors: [{themeId: '1', error: {type: 'abort', message: 'Deletion failed'}}],
        })
        expect(process.exitCode).toBe(1)
      })
    } finally {
      restoreExitCode(originalExitCode)
    }
  })

  test('collects results in configured order and sequences mutations for the same store', async () => {
    const deleted: number[] = []
    vi.mocked(findThemes).mockImplementation(async (_session, options) => [{...theme, id: Number(options.themes?.[0])}])
    vi.mocked(themeDelete).mockImplementation(async (id) => {
      if (id === 1) await new Promise((resolve) => setTimeout(resolve, 20))
      deleted.push(id)
      return true
    })
    await inEnvironments(async () => {
      await withCapturedStandardStreams(async ({stdout, stderr}) => {
        await run([
          '--show-all',
          '--environment',
          'first',
          '--environment',
          'third',
          '--environment',
          'second',
          '--force',
          '--json',
        ])
        const result = JSON.parse(stdout())
        expect(result).not.toHaveProperty('status')
        expect(result.environments.every(({result}: {result: {status: string}}) => result.status === 'success')).toBe(
          true,
        )
        expect(result.environments.map(({environment}: {environment: string}) => environment)).toEqual([
          'first',
          'third',
          'second',
        ])
        expect(result.environments.map(({result}: {result: {themes: {id: string}[]}}) => result.themes[0]?.id)).toEqual(
          ['1', '3', '2'],
        )
        expect(deleted).toEqual([2, 1, 3])
        expect(stderr()).toBe('')
        expect(addSensitiveMetadata).toHaveBeenCalled()
      })
    })
  })

  test.each([false, true])('preserves failed environments and exits nonzero (all fail: %s)', async (allFail) => {
    vi.mocked(findThemes).mockImplementation(async (_session, options) => [{...theme, id: Number(options.themes?.[0])}])
    vi.mocked(themeDelete).mockImplementation(async (id) => {
      if (allFail || id === 1) throw new Error('Deletion failed')
      return true
    })
    const exitCode = process.exitCode
    await inEnvironments(async () => {
      await withCapturedStandardStreams(async ({stdout, stderr}) => {
        await run(['--show-all', '--environment', 'first', '--environment', 'second', '--force', '--json'])
        expect(JSON.parse(stdout()).environments.map(({environment}: {environment: string}) => environment)).toEqual([
          'first',
          'second',
        ])
        const events = stderr()
          .trim()
          .split('\n')
          .map((line) => JSON.parse(line))
        expect(events).toHaveLength(allFail ? 2 : 1)
        expect(events[0]).toMatchObject({type: 'diagnostic', level: 'error', code: 'theme-environment-failed'})
        expect(process.exitCode).toBe(1)
        restoreExitCode(exitCode)
      })
    })
  })

  test('preserves invalid environments and emits a typed warning', async () => {
    vi.mocked(findThemes).mockResolvedValue([theme])
    await inEnvironments(async () => {
      await withCapturedStandardStreams(async ({stdout, stderr}) => {
        await run(['--show-all', '--environment', 'invalid', '--environment', 'first', '--force', '--json'])
        expect(JSON.parse(stdout()).environments.map(({environment}: {environment: string}) => environment)).toEqual([
          'invalid',
          'first',
        ])
        restoreExitCode(undefined)
        expect(JSON.parse(stderr())).toMatchObject({
          type: 'diagnostic',
          level: 'warning',
          code: 'theme-environment-invalid',
        })
      })
    })
  })

  test.each([
    {status: 'success', themes: [{...theme, id: '1', shop: store}]},
    {status: 'success', themes: [{...theme, processing: null, shop: store}]},
    {status: 'success', themes: [{...theme, shop: 1}]},
    {environments: [{environment: 1, result: {status: 'success', themes: []}}]},
  ])('rejects malformed results %#', (result) => {
    expect(() => themeDeleteJsonOutputSchema.validate(result)).toThrow()
  })
})

describeJsonCommand({
  command: Delete,
  commandId: 'theme:delete',
  moduleURL: new URL('../../../../../cli/src/index.ts', import.meta.url).href,
  args: ['--store', store, '--theme', '1', '--force'],
  expectedResult: {
    status: 'success',
    changed: true,
    themes: [{id: '1', name: 'Original', role: 'unpublished', storeDomain: store, processing: false, sourceUrl: null}],
  },
  expectedSchema: themeResultJsonSchema,
  setup: () => {
    vi.mocked(ensureAuthenticatedThemes).mockImplementation(async (storeFqdn) => ({token: 'token', storeFqdn}))
    vi.mocked(findThemes).mockResolvedValue([theme])
  },
  assertExecuted: () => {
    const session = {token: 'token', storeFqdn: store}
    expect(ensureAuthenticatedThemes).toHaveBeenCalledExactlyOnceWith(store, undefined)
    expect(findThemes).toHaveBeenCalledExactlyOnceWith(session, expect.objectContaining({themes: ['1'], force: true}))
    expect(themeDelete).toHaveBeenCalledExactlyOnceWith(1, session)
  },
  assertNotExecuted: () => {
    expect(findThemes).not.toHaveBeenCalled()
    expect(themeDelete).not.toHaveBeenCalled()
  },
  textOutput: ({stdout, stderr}) => {
    expect(stdout).toBe('')
    expect(stderr).toContain("'Original' (#1)")
    expect(stderr).toContain(`was deleted from ${store}.`)
  },
  diagnostics: {
    setup: () => {
      vi.mocked(themeDelete).mockImplementation(async () => {
        outputWarn('Retrying request')
        return true
      })
    },
    expectedEvents: [{type: 'diagnostic', level: 'warning', message: 'Retrying request'}],
  },
  failure: {
    setup: () => {
      vi.mocked(themeDelete).mockRejectedValue(new Error('Deletion failed'))
    },
    expectedError: {
      error: {
        type: 'abort',
        message: 'Deletion failed',
        details: {errors: [{themeId: '1', message: 'Deletion failed'}]},
      },
    },
    exitCode: 1,
  },
})
