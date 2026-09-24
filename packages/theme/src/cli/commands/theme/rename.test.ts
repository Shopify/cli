import Rename from './rename.js'
import {themeRenameJsonOutputSchema} from '../../services/rename/types.js'
import {findOrSelectTheme} from '../../utilities/theme-selector.js'
import {Config} from '@oclif/core'
import {ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {themeUpdate} from '@shopify/cli-kit/node/themes/api'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {runWithCommandEventsForCommand} from '@shopify/cli-kit/node/command-events'
import {inTemporaryDirectory, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {outputWarn} from '@shopify/cli-kit/node/output'
import {describe, expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/themes/api')
vi.mock('@shopify/cli-kit/node/metadata')
vi.mock('../../utilities/theme-selector.js')
vi.mock('../../utilities/theme-store.js', () => ({ensureThemeStore: ({store}: {store: string}) => store}))

const originalTheme = {id: 1, name: 'Original', role: 'unpublished', processing: false, createdAtRuntime: false}
const renamedTheme = {...originalTheme, name: 'Renamed Theme'}
const store = 'test.myshopify.com'

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
  test('exposes its schema and JSON flag in help', () => {
    expect(Rename.jsonOutputSchema).toBe(themeRenameJsonOutputSchema)
    expect(Rename.flags.json).toBeDefined()
    expect(Rename.description).toContain('ThemeRenameResult')
  })

  test.each([undefined, '', 'https://example.com/theme.zip'])(
    'returns the updated theme and omits missing src (%s)',
    async (src) => {
      vi.mocked(findOrSelectTheme).mockResolvedValue(originalTheme)
      vi.mocked(themeUpdate).mockResolvedValue({...renamedTheme, src})
      await withCapturedStandardStreams(async ({stdout, stderr}) => {
        await run(['--store', store, '--theme', '1', '--name', 'Renamed Theme', '--json'])
        expect(JSON.parse(stdout())).toEqual({
          theme: {...renamedTheme, ...(src === undefined ? {} : {src}), shop: store},
        })
        expect(stderr()).toBe('')
      })
    },
  )

  test('routes diagnostics to stderr', async () => {
    vi.mocked(findOrSelectTheme).mockResolvedValue(originalTheme)
    vi.mocked(themeUpdate).mockImplementation(async () => {
      outputWarn('Retrying request')
      return renamedTheme
    })
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await run(['--store', store, '--theme', '1', '--name', 'Renamed Theme', '--json'])
      expect(JSON.parse(stdout()).theme.name).toBe('Renamed Theme')
      expect(JSON.parse(stderr())).toMatchObject({type: 'diagnostic', level: 'warning', message: 'Retrying request'})
    })
  })

  test('leaves execution failures to the shared error handler without writing a result', async () => {
    vi.mocked(findOrSelectTheme).mockResolvedValue(originalTheme)
    vi.mocked(themeUpdate).mockRejectedValue(new Error('Renameing failed'))
    await withCapturedStandardStreams(async ({stdout}) => {
      await expect(run(['--store', store, '--theme', '1', '--name', 'Renamed Theme', '--json'])).rejects.toThrow(
        'Renameing failed',
      )
      expect(stdout()).toBe('')
    })
  })

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
          environments: environments.map((environment) => ({
            environment,
            result: {theme: {...renamedTheme, shop: `${environment}.myshopify.com`}},
          })),
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
        expect(process.exitCode).toBe(exitCode)
      })
    })
  })

  test.each([
    {theme: {...renamedTheme, id: '1', shop: store}},
    {theme: {...renamedTheme, shop: null}},
    {theme: {...renamedTheme, src: false, shop: store}},
    {environments: [{environment: 'first', result: {theme: {...renamedTheme, role: null, shop: store}}}]},
  ])('rejects malformed results %#', (result) => {
    expect(() => themeRenameJsonOutputSchema.validate(result)).toThrow()
  })
})
