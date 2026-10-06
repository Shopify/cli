import Build from './build.js'
import build from '../../services/build.js'
import {
  getCachedAppInfo,
  setCachedAppInfo,
  type CachedAppInfo,
  type AppLocalStorageSchema,
} from '../../services/local-storage.js'
import {LocalStorage} from '@shopify/cli-kit/node/local-storage'
import {runWithCommandEventsForCommand} from '@shopify/cli-kit/node/command-events'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {inTemporaryDirectory, mkdir, writeFile} from '@shopify/cli-kit/node/fs'
import {dirname, joinPath} from '@shopify/cli-kit/node/path'
import {Config} from '@oclif/core'
import {expect, test, vi} from 'vitest'
import {fileURLToPath} from 'node:url'

const scope = vi.hoisted(() => ({storage: undefined as LocalStorage<AppLocalStorageSchema> | undefined}))
vi.mock('../../services/local-storage.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/local-storage.js')>()
  const cache = () => {
    if (!scope.storage) throw new Error('Fixture cache not initialized.')
    return scope.storage
  }
  return {
    ...actual,
    getCachedAppInfo: (directory: string) => actual.getCachedAppInfo(directory, cache()),
    setCachedAppInfo: (options: CachedAppInfo) => actual.setCachedAppInfo(options, cache()),
    clearCurrentConfigFile: (directory: string) => actual.clearCurrentConfigFile(directory, cache()),
  }
})
vi.mock('../../services/build.js')
vi.mock('@shopify/cli-kit/node/metadata', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/metadata')>()),
  addPublicMetadata: vi.fn(),
  addSensitiveMetadata: vi.fn(),
}))

// Exercise command parse/run and actual local context; init hooks/analytics are not the subject.
test('actual build context recovers stale sole config with json/no-input and writes one result plus diagnostics', async () => {
  await inTemporaryDirectory(async (root) => {
    const directory = joinPath(root, 'app')
    await mkdir(directory)
    scope.storage = new LocalStorage<AppLocalStorageSchema>({cwd: joinPath(root, 'isolated-cache')})
    await writeFile(joinPath(directory, 'package.json'), '{"name":"recovery-fixture"}')
    await writeFile(
      joinPath(directory, 'shopify.app.toml'),
      `name = "Recovery fixture"
client_id = "public-fixture-id"
application_url = "https://example.com"
embedded = true
[auth]
redirect_urls = []
[webhooks]
api_version = "2023-04"
`,
    )
    setCachedAppInfo({directory, configFile: 'shopify.app.deleted.toml'})
    vi.mocked(build).mockImplementation(async ({app}) => ({
      status: 'success',
      app: {name: app.name, directory: app.directory},
      webs: [],
      extensions: [],
    }))
    vi.stubEnv('SHOPIFY_FLAG_NO_INPUT', '1')
    try {
      const config = await Config.load({root: joinPath(dirname(fileURLToPath(import.meta.url)), '../../../..')})
      const argv = ['--path', directory, '--json', '--no-input', '--skip-dependencies-installation']
      const command = new Build(argv, config)
      await withCapturedStandardStreams(async ({stdout, stderr}) => {
        const returned = await runWithCommandEventsForCommand(argv, () => command.run())
        expect(returned.app.configPath).toBe(joinPath(directory, 'shopify.app.toml'))
        expect(getCachedAppInfo(directory)?.configFile).toBe('shopify.app.toml')
        expect(JSON.parse(stdout())).toStrictEqual({
          status: 'success',
          app: {name: 'Recovery fixture', directory},
          webs: [],
          extensions: [],
        })
        const events = stderr()
          .trim()
          .split('\n')
          .map((line) => JSON.parse(line))
        expect(events).toContainEqual(
          expect.objectContaining({
            type: 'diagnostic',
            level: 'warning',
            message: expect.stringContaining("Couldn't find shopify.app.deleted.toml"),
          }),
        )
        expect(events.every((event) => event.type === 'diagnostic' || event.type === 'progress')).toBe(true)
      })
      expect(build).toHaveBeenCalledWith(expect.objectContaining({skipDependenciesInstallation: true}))
    } finally {
      scope.storage = undefined
      vi.unstubAllEnvs()
    }
  })
})

test('actual build getter exposes the rooted directory constraint and honest description', () => {
  const schema = JSON.parse(JSON.stringify(Build.jsonOutputSchema.jsonSchema))
  const directory = schema.definitions.BuiltApp.properties.directory
  expect(directory.description).toContain('not an existence or containment guarantee')
  const published = new RegExp(directory.pattern)
  for (const path of ['/fixture', 'C:\\fixture', '\\\\server\\share']) {
    expect(published.test(path)).toBe(true)
    expect(() =>
      Build.jsonOutputSchema.validate({
        status: 'success',
        app: {name: 'Fixture', directory: path},
        webs: [],
        extensions: [],
      }),
    ).not.toThrow()
  }
  expect(published.test('relative')).toBe(false)
  expect(() =>
    Build.jsonOutputSchema.validate({
      status: 'success',
      app: {name: 'Fixture', directory: 'relative'},
      webs: [],
      extensions: [],
    }),
  ).toThrow()
})
