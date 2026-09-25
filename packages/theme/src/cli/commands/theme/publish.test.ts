import Publish from './publish.js'
import {themePublishJsonOutputSchema} from '../../services/publish/types.js'
import {findOrSelectTheme} from '../../utilities/theme-selector.js'
import {Config} from '@oclif/core'
import {ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {themePublish} from '@shopify/cli-kit/node/themes/api'
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
const publishedTheme = {...originalTheme, role: 'live'}
const store = 'test.myshopify.com'

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
  test('exposes its schema and JSON flag in help', () => {
    expect(Publish.jsonOutputSchema).toBe(themePublishJsonOutputSchema)
    expect(Publish.flags.json).toBeDefined()
    expect(Publish.description).toContain('ThemePublishResult')
  })

  test.each([undefined, '', 'https://example.com/theme.zip'])(
    'returns the updated theme and omits missing src (%s)',
    async (src) => {
      vi.mocked(findOrSelectTheme).mockResolvedValue(originalTheme)
      vi.mocked(themePublish).mockResolvedValue({...publishedTheme, src})
      await withCapturedStandardStreams(async ({stdout, stderr}) => {
        await run(['--store', store, '--theme', '1', '--force', '--json'])
        expect(JSON.parse(stdout())).toEqual({
          theme: {...publishedTheme, ...(src === undefined ? {} : {src}), shop: store},
        })
        expect(stderr()).toBe('')
      })
    },
  )

  test('routes diagnostics to stderr', async () => {
    vi.mocked(findOrSelectTheme).mockResolvedValue(originalTheme)
    vi.mocked(themePublish).mockImplementation(async () => {
      outputWarn('Retrying request')
      return publishedTheme
    })
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await run(['--store', store, '--theme', '1', '--force', '--json'])
      expect(JSON.parse(stdout()).theme.role).toBe('live')
      expect(JSON.parse(stderr())).toMatchObject({type: 'diagnostic', level: 'warning', message: 'Retrying request'})
    })
  })

  test('leaves execution failures to the shared error handler without writing a result', async () => {
    vi.mocked(findOrSelectTheme).mockResolvedValue(originalTheme)
    vi.mocked(themePublish).mockRejectedValue(new Error('Publishing failed'))
    await withCapturedStandardStreams(async ({stdout}) => {
      await expect(run(['--store', store, '--theme', '1', '--force', '--json'])).rejects.toThrow('Publishing failed')
      expect(stdout()).toBe('')
    })
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
          environments: environments.map((environment) => ({
            environment,
            result: {theme: {...publishedTheme, shop: `${environment}.myshopify.com`}},
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
    {theme: {...publishedTheme, id: '1', shop: store}},
    {theme: {...publishedTheme, shop: null}},
    {theme: {...publishedTheme, src: false, shop: store}},
    {environments: [{environment: 'first', result: {theme: {...publishedTheme, role: null, shop: store}}}]},
  ])('rejects malformed results %#', (result) => {
    expect(() => themePublishJsonOutputSchema.validate(result)).toThrow()
  })
})
