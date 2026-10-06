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
import {unstyled} from '@shopify/cli-kit/node/output'
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

async function withBuildFixture(
  options: {json: boolean; multipleConfigurations?: boolean},
  run: (fixture: {command: Build; argv: string[]; directory: string}) => Promise<void>,
) {
  await inTemporaryDirectory(async (root) => {
    const directory = joinPath(root, 'app')
    await mkdir(directory)
    scope.storage = new LocalStorage<AppLocalStorageSchema>({cwd: joinPath(root, 'isolated-cache')})
    await writeFile(joinPath(directory, 'package.json'), '{"name":"recovery-fixture"}')
    const configuration = `name = "Recovery fixture"
client_id = "public-fixture-id"
application_url = "https://example.com"
embedded = true
[auth]
redirect_urls = []
[webhooks]
api_version = "2023-04"
`
    await writeFile(joinPath(directory, 'shopify.app.toml'), configuration)
    if (options.multipleConfigurations) await writeFile(joinPath(directory, 'shopify.app.other.toml'), configuration)
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
      const argv = [
        '--path',
        directory,
        '--no-input',
        '--skip-dependencies-installation',
        ...(options.json ? ['--json'] : []),
      ]
      const command = new Build(argv, config)
      await run({command, argv, directory})
    } finally {
      scope.storage = undefined
      vi.unstubAllEnvs()
    }
  })
}

test.each([false, true])('build recovers a stale sole config with no input: json=%s', async (json) => {
  await withBuildFixture({json}, async ({command, argv, directory}) => {
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      const returned = await runWithCommandEventsForCommand(argv, () => command.run())
      expect(returned.app.configPath).toBe(joinPath(directory, 'shopify.app.toml'))
      expect(getCachedAppInfo(directory)?.configFile).toBe('shopify.app.toml')
      if (json) {
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
      } else {
        expect(stdout()).toBe('')
        expect(unstyled(stderr())).toContain("Couldn't find shopify.app.deleted.toml")
        expect(unstyled(stderr())).toContain('warning')
        expect(unstyled(stderr())).toContain('Recovery fixture built!')
      }
    })
    expect(build).toHaveBeenCalledWith(expect.objectContaining({skipDependenciesInstallation: true}))
  })
})

test.each([false, true])('build rejects multiple replacement configs without input: json=%s', async (json) => {
  await withBuildFixture({json, multipleConfigurations: true}, async ({command, argv, directory}) => {
    await withCapturedStandardStreams(async ({stdout}) => {
      await expect(runWithCommandEventsForCommand(argv, () => command.run())).rejects.toThrow('Failed to prompt')
      expect(stdout()).toBe('')
      expect(getCachedAppInfo(directory)?.configFile).toBe('shopify.app.deleted.toml')
      expect(build).not.toHaveBeenCalled()
    })
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
