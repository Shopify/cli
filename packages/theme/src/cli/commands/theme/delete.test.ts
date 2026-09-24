import Delete from './delete.js'
import {themeDeleteJsonOutputSchema} from '../../services/delete/types.js'
import {findThemes} from '../../utilities/theme-selector.js'
import {Config} from '@oclif/core'
import {ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {themeDelete} from '@shopify/cli-kit/node/themes/api'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {runWithCommandEventsForCommand} from '@shopify/cli-kit/node/command-events'
import {inTemporaryDirectory, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {outputWarn} from '@shopify/cli-kit/node/output'
import {addSensitiveMetadata} from '@shopify/cli-kit/node/metadata'
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

describe('theme delete JSON output', () => {
  test('exposes its schema and JSON flag in help', () => {
    expect(Delete.jsonOutputSchema).toBe(themeDeleteJsonOutputSchema)
    expect(Delete.flags.json).toBeDefined()
    expect(Delete.description).toContain('ThemeDeleteResult')
  })

  test.each([
    {themes: []},
    {themes: [theme]},
    {themes: [theme, {...theme, id: 2, src: 'https://example.com/theme.zip'}]},
  ])('writes one complete result without terminal output %#', async ({themes}) => {
    vi.mocked(findThemes).mockResolvedValue(themes)
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await run(['--store', store, '--theme', '1', '--force', '--json'])
      expect(JSON.parse(stdout())).toEqual({themes: themes.map((theme) => ({...theme, shop: store}))})
      expect(stderr()).toBe('')
    })
  })

  test('writes diagnostics to stderr', async () => {
    vi.mocked(findThemes).mockResolvedValue([theme])
    vi.mocked(themeDelete).mockImplementation(async () => {
      outputWarn('Retrying request')
      return true
    })
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await run(['--store', store, '--theme', '1', '--force', '--json'])
      expect(JSON.parse(stdout())).toHaveProperty('themes')
      expect(JSON.parse(stderr())).toMatchObject({type: 'diagnostic', level: 'warning', message: 'Retrying request'})
    })
  })

  test('does not emit a successful result when deletion fails', async () => {
    vi.mocked(findThemes).mockResolvedValue([theme])
    vi.mocked(themeDelete).mockRejectedValue(new Error('Deletion failed'))
    await withCapturedStandardStreams(async ({stdout}) => {
      await expect(run(['--store', store, '--theme', '1', '--force', '--json'])).rejects.toThrow('Deletion failed')
      expect(stdout()).toBe('')
    })
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
        expect(result.environments.map(({environment}: {environment: string}) => environment)).toEqual([
          'first',
          'third',
          'second',
        ])
        expect(result.environments.map(({result}: {result: {themes: {id: number}[]}}) => result.themes[0]?.id)).toEqual(
          [1, 3, 2],
        )
        expect(deleted).toEqual([2, 1, 3])
        expect(stderr()).toBe('')
        expect(addSensitiveMetadata).toHaveBeenCalled()
      })
    })
  })

  test.each([false, true])('omits failed environments and preserves exit behavior (all fail: %s)', async (allFail) => {
    vi.mocked(findThemes).mockImplementation(async (_session, options) => [{...theme, id: Number(options.themes?.[0])}])
    vi.mocked(themeDelete).mockImplementation(async (id) => {
      if (allFail || id === 1) throw new Error('Deletion failed')
      return true
    })
    const exitCode = process.exitCode
    await inEnvironments(async () => {
      await withCapturedStandardStreams(async ({stdout, stderr}) => {
        await run(['--show-all', '--environment', 'first', '--environment', 'second', '--force', '--json'])
        expect(JSON.parse(stdout()).environments.map(({environment}: {environment: string}) => environment)).toEqual(
          allFail ? [] : ['second'],
        )
        const events = stderr()
          .trim()
          .split('\n')
          .map((line) => JSON.parse(line))
        expect(events).toHaveLength(allFail ? 2 : 1)
        expect(events[0]).toMatchObject({type: 'diagnostic', level: 'error', code: 'theme-environment-failed'})
        expect(process.exitCode).toBe(exitCode)
      })
    })
  })

  test('omits invalid environments and emits a typed warning', async () => {
    vi.mocked(findThemes).mockResolvedValue([theme])
    await inEnvironments(async () => {
      await withCapturedStandardStreams(async ({stdout, stderr}) => {
        await run(['--show-all', '--environment', 'invalid', '--environment', 'first', '--force', '--json'])
        expect(JSON.parse(stdout()).environments.map(({environment}: {environment: string}) => environment)).toEqual([
          'first',
        ])
        expect(JSON.parse(stderr())).toMatchObject({
          type: 'diagnostic',
          level: 'warning',
          code: 'theme-environment-invalid',
        })
      })
    })
  })

  test.each([
    {themes: [{...theme, id: '1', shop: store}]},
    {themes: [{...theme, processing: null, shop: store}]},
    {themes: [{...theme, shop: 1}]},
    {environments: [{environment: 1, result: {themes: []}}]},
  ])('rejects malformed results %#', (result) => {
    expect(() => themeDeleteJsonOutputSchema.validate(result)).toThrow()
  })
})
