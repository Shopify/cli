import Dev from './dev.js'
import {dev} from '../../services/dev.js'
import {findOrSelectTheme} from '../../utilities/theme-selector.js'
import {ensureLiveThemeConfirmed} from '../../utilities/theme-ui.js'
import {devInstanceLogOutputSchema} from '@shopify/cli-kit/node/dev-instance'
import {launchCLI} from '@shopify/cli-kit/node/cli-launcher'
import {inTemporaryDirectory} from '@shopify/cli-kit/node/fs'
import {ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {loadEnvironment} from '@shopify/cli-kit/node/environments'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {runWithCommandEventsForCommand} from '@shopify/cli-kit/node/command-events'
import {AbortError} from '@shopify/cli-kit/node/error'
import {Config} from '@oclif/core'
import {afterEach, expect, test, vi} from 'vitest'

vi.mock('../../services/dev.js')
vi.mock('../../services/metafields-pull.js')
vi.mock('../../utilities/theme-selector.js')
vi.mock('../../utilities/theme-ui.js')
vi.mock('../../utilities/theme-store.js', () => ({ensureThemeStore: ({store}: {store: string}) => store}))
vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/environments')

afterEach(() => vi.unstubAllEnvs())

const session = {storeFqdn: 'fixture.myshopify.com', token: 'fixture'}
const theme = {id: 123, name: 'Fixture', role: 'development', processing: false, createdAtRuntime: false}

test('declares the shared stream schema and JSON flags without changing the Markdown description', () => {
  expect(Dev.jsonOutputSchema).toBe(devInstanceLogOutputSchema)
  expect(Dev.flags.json.char).toBe('j')
  expect(Dev.flags.json.env).toBe('SHOPIFY_FLAG_JSON')
  expect(Dev.baseFlags).toHaveProperty('json-schema')
  expect(Dev.description).toContain('DevInstanceLogEntry')
  expect(Dev.descriptionWithMarkdown).not.toContain('DevInstanceLogEntry')
})

test('prints the stream schema without authentication or starting dev', async () => {
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await launchCLI({
      moduleURL: new URL('../../../../../cli/package.json', import.meta.url).href,
      argv: ['theme', 'dev', '--json-schema'],
      lazyCommandLoader: async (id) => (id === 'theme:dev' ? Dev : undefined),
    })
    const {definitions} = JSON.parse(stdout())
    expect(definitions.Result.required).toEqual(['timestamp', 'message'])
    expect(definitions.Result.properties).not.toHaveProperty('type')
    expect(definitions.Error).toBeDefined()
    expect(stderr()).toBe('')
    expect(ensureAuthenticatedThemes).not.toHaveBeenCalled()
    expect(dev).not.toHaveBeenCalled()
  })
})

test.each(['--json', '-j', 'env', 'named environment', 'configured environment', 'no input'])(
  'passes JSON mode to the service for %s without collecting a finite result',
  async (source) => {
    await inTemporaryDirectory(async (directory) => {
      vi.mocked(ensureAuthenticatedThemes).mockResolvedValue(session)
      vi.mocked(findOrSelectTheme).mockResolvedValue(theme)
      vi.mocked(ensureLiveThemeConfirmed).mockResolvedValue(true)
      vi.mocked(loadEnvironment).mockResolvedValue({
        store: session.storeFqdn,
        password: 'fixture',
        theme: '123',
        ...(source === 'configured environment' ? {json: true} : {}),
      })
      const config = new Config({root: __dirname})
      await config.load()
      const argv = ['--path', directory, '--store', session.storeFqdn, '--password', 'fixture', '--theme', '123']
      if (source === 'env') vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
      else if (source !== 'configured environment') argv.push(source.startsWith('-') ? source : '--json')
      if (source.endsWith('environment')) argv.push('--environment', 'local')
      if (source === 'no input') argv.push('--no-input')

      await withCapturedStandardStreams(async ({stdout}) => {
        await runWithCommandEventsForCommand(argv, () => new Dev(argv, config).run())
        expect(dev).toHaveBeenCalledOnce()
        expect(dev).toHaveBeenCalledWith(expect.objectContaining({json: true, directory, theme}))
        expect(stdout()).toBe('')
      })
    })
  },
)

test('renders fatal errors through the CLI JSON handler', async () => {
  await inTemporaryDirectory(async (directory) => {
    vi.mocked(ensureAuthenticatedThemes).mockResolvedValue(session)
    vi.mocked(findOrSelectTheme).mockResolvedValue(theme)
    vi.mocked(ensureLiveThemeConfirmed).mockResolvedValue(true)
    vi.mocked(dev).mockRejectedValue(new AbortError('Fixture startup failure'))
    await withCapturedStandardStreams(async ({stdout}) => {
      await expect(
        Dev.run(
          ['--path', directory, '--store', session.storeFqdn, '--password', 'fixture', '--theme', '123', '--json'],
          import.meta.url,
        ),
      ).rejects.toThrow()
      expect(JSON.parse(stdout())).toEqual({error: {type: 'abort', message: 'Fixture startup failure'}})
    })
  })
})
