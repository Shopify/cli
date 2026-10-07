import Build from './build.js'
import build from '../../services/build.js'
import * as localStorage from '../../services/local-storage.js'
import {LocalStorage} from '@shopify/cli-kit/node/local-storage'
import {runWithCommandEventsForCommand} from '@shopify/cli-kit/node/command-events'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {inTemporaryDirectory, mkdir, writeFile} from '@shopify/cli-kit/node/fs'
import {dirname, joinPath} from '@shopify/cli-kit/node/path'
import {unstyled} from '@shopify/cli-kit/node/output'
import {Config} from '@oclif/core'
import {expect, test, vi} from 'vitest'
import {fileURLToPath} from 'node:url'

vi.mock('../../services/build.js')
vi.mock('@shopify/cli-kit/node/multiple-installation-warning')

async function withBuildFixture(
  options: {json: boolean; multipleConfigurations?: boolean},
  run: (fixture: {command: Build; argv: string[]; directory: string}) => Promise<void>,
) {
  await inTemporaryDirectory(async (root) => {
    const directory = joinPath(root, 'app')
    await mkdir(directory)
    const storage = new LocalStorage<localStorage.AppLocalStorageSchema>({cwd: joinPath(root, 'isolated-cache')})
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
    const readCache = localStorage.getCachedAppInfo
    const writeCache = localStorage.setCachedAppInfo
    const readCacheSpy = vi
      .spyOn(localStorage, 'getCachedAppInfo')
      .mockImplementation((directory) => readCache(directory, storage))
    const writeCacheSpy = vi
      .spyOn(localStorage, 'setCachedAppInfo')
      .mockImplementation((options) => writeCache(options, storage))
    vi.mocked(build).mockImplementation(async ({app}) => ({
      status: 'success',
      appName: app.name,
    }))
    vi.stubEnv('SHOPIFY_FLAG_NO_INPUT', '1')
    try {
      localStorage.setCachedAppInfo({directory, configFile: 'shopify.app.deleted.toml'})
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
      readCacheSpy.mockRestore()
      writeCacheSpy.mockRestore()
      vi.unstubAllEnvs()
    }
  })
}

test.each([false, true])('build recovers a stale sole config with no input: json=%s', async (json) => {
  await withBuildFixture({json}, async ({command, argv, directory}) => {
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      const returned = await runWithCommandEventsForCommand(argv, () => command.run())
      expect(returned.app.configPath).toBe(joinPath(directory, 'shopify.app.toml'))
      expect(localStorage.getCachedAppInfo(directory)?.configFile).toBe('shopify.app.toml')
      if (json) {
        expect(JSON.parse(stdout())).toStrictEqual({status: 'success'})
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
      expect(localStorage.getCachedAppInfo(directory)?.configFile).toBe('shopify.app.deleted.toml')
      expect(build).not.toHaveBeenCalled()
    })
  })
})

test('build exposes only the success status in its result schema', () => {
  expect(Build.jsonOutputSchema.jsonSchema).toStrictEqual({
    type: 'object',
    properties: {status: {type: 'string', const: 'success'}},
    required: ['status'],
    additionalProperties: false,
    title: 'AppBuildResult',
    $schema: 'http://json-schema.org/draft-07/schema#',
  })
})
