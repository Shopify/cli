import Dev from './dev.js'
import {dev} from '../../services/dev.js'
import {themeDevOutputSchema} from '../../services/dev/schema.js'
import {ensureThemeStore} from '../../utilities/theme-store.js'
import {findOrSelectTheme} from '../../utilities/theme-selector.js'
import {ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {buildTheme} from '@shopify/cli-kit/node/themes/factories'
import {DEVELOPMENT_THEME_ROLE} from '@shopify/cli-kit/node/themes/utils'
import {
  acquireDevInstance,
  devInstanceLogOutputSchema,
  DEV_INSTANCE_ALREADY_RUNNING_CODE,
} from '@shopify/cli-kit/node/dev-instance'
import {AbortError} from '@shopify/cli-kit/node/error'
import {inTemporaryDirectory, readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {launchCLI} from '@shopify/cli-kit/node/cli-launcher'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('../../services/dev.js')
vi.mock('../../services/metafields-pull.js')
vi.mock('../../utilities/theme-store.js')
vi.mock('../../utilities/theme-selector.js')
vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/analytics')
vi.mock('@shopify/cli-kit/node/metadata')

const store = 'my-store.myshopify.com'
const theme = buildTheme({id: 123, name: 'My Theme', role: DEVELOPMENT_THEME_ROLE})!

describe('theme dev command', () => {
  beforeEach(() => {
    vi.mocked(ensureThemeStore).mockReturnValue(store)
    vi.mocked(ensureAuthenticatedThemes).mockResolvedValue({token: 'token', storeFqdn: store})
    vi.mocked(findOrSelectTheme).mockResolvedValue(theme)
  })

  afterEach(() => vi.unstubAllEnvs())

  async function run(directory: string, argv: string[]) {
    await Dev.run(['--path', directory, '--store', store, '--theme', theme.id.toString(), ...argv], import.meta.url)
  }

  function lastStdoutRecord(stdout: string) {
    return JSON.parse(stdout.trim().split('\n').at(-1)!)
  }

  test('declares its streaming schema and JSON flag', () => {
    expect(Dev.jsonOutputSchema).toBe(themeDevOutputSchema)
    expect(Dev.jsonOutputSchema.schema).toBe(devInstanceLogOutputSchema.schema)
    expect(Dev.flags.json.char).toBe('j')
    expect(Dev.flags.json.env).toBe('SHOPIFY_FLAG_JSON')
    expect(Dev.descriptionForHelp()).toContain('DevInstanceLogEntry')
  })

  test('prints the stream and instance schemas before authenticating', async () => {
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await launchCLI({
        moduleURL: new URL('../../../../../cli/package.json', import.meta.url).href,
        argv: ['theme', 'dev', '--json-schema'],
        lazyCommandLoader: async (id) => (id === 'theme:dev' ? Dev : undefined),
      })
      const {definitions} = JSON.parse(stdout())
      expect(definitions.Result.required).toEqual(['timestamp', 'message'])
      expect(definitions.DevInstance.properties.command.const).toBe('theme dev')
      expect(Object.keys(definitions.DevInstance.properties.details.properties.urls.properties)).toEqual([
        'local',
        'preview',
        'themeEditor',
        'giftCard',
      ])
      expect(stderr()).toBe('')
      expect(ensureAuthenticatedThemes).not.toHaveBeenCalled()
      expect(dev).not.toHaveBeenCalled()
    })
  })

  test.each(['--json', '-j', 'env'])('%s runs dev in JSON mode', async (source) => {
    await inTemporaryDirectory(async (directory) => {
      if (source === 'env') vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
      await withCapturedStandardStreams(async ({stdout}) => {
        await run(directory, source.startsWith('-') ? [source] : [])
        expect(stdout()).toBe('')
      })
      expect(dev).toHaveBeenCalledWith(expect.objectContaining({directory, json: true, theme}))
    })
  })

  test('a single environment runs dev instead of an environment batch', async () => {
    await inTemporaryDirectory(async (directory) => {
      await writeFile(joinPath(directory, 'shopify.theme.toml'), '[environments.development]\nlisting = "summer"\n')
      await withCapturedStandardStreams(async ({stdout}) => {
        await run(directory, ['--json', '--environment', 'development'])
        expect(stdout()).toBe('')
      })
      expect(dev).toHaveBeenCalledWith(expect.objectContaining({json: true, listing: 'summer'}))
    })
  })

  test('a fatal error uses the JSON error envelope', async () => {
    await inTemporaryDirectory(async (directory) => {
      vi.mocked(dev).mockRejectedValue(new AbortError('Dev failed'))
      await withCapturedStandardStreams(async ({stdout}) => {
        await expect(run(directory, ['--json'])).rejects.toThrow()
        expect(lastStdoutRecord(stdout())).toEqual({error: {type: 'abort', message: 'Dev failed'}})
      })
    })
  })

  test('a duplicate start reports the running instance without changing its log', async () => {
    const {dev: realDev} = await vi.importActual<typeof import('../../services/dev.js')>('../../services/dev.js')
    vi.mocked(dev).mockImplementation(realDev)
    await inTemporaryDirectory(async (directory) => {
      const running = await acquireDevInstance({command: 'theme dev', directory, key: `${store}:${theme.id}`})
      try {
        await running.log({message: 'Existing session'})
        const existingLog = await readFile(running.paths.logFile)
        await withCapturedStandardStreams(async ({stdout}) => {
          await expect(run(directory, ['--json', '--force'])).rejects.toThrow()
          expect(lastStdoutRecord(stdout())).toMatchObject({
            error: {type: 'abort', code: DEV_INSTANCE_ALREADY_RUNNING_CODE, details: {instance: running.info}},
          })
        })
        await expect(readFile(running.paths.logFile)).resolves.toBe(existingLog)
      } finally {
        await running.release()
      }
    })
  })
})
