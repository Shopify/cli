import Build from './build.js'
import build from '../../services/build.js'
import * as localStorage from '../../services/local-storage.js'
import {LocalStorage} from '@shopify/cli-kit/node/local-storage'
import {runWithCommandEventsForCommand} from '@shopify/cli-kit/node/command-events'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {inTemporaryDirectory, readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {dirname, joinPath} from '@shopify/cli-kit/node/path'
import {Config} from '@oclif/core'
import {expect, test, vi} from 'vitest'
import {fileURLToPath} from 'node:url'

vi.mock('../../services/build.js')
vi.mock('@shopify/cli-kit/node/multiple-installation-warning')

test.each([false, true])('JSON stale-config recovery respects no-input: multiple replacements=%s', async (multiple) => {
  await inTemporaryDirectory(async (directory) => {
    const storage = new LocalStorage<localStorage.AppLocalStorageSchema>({cwd: joinPath(directory, 'cache')})
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
    if (multiple) {
      await writeFile(
        joinPath(directory, 'shopify.app.other.toml'),
        await readFile(joinPath(directory, 'shopify.app.toml')),
      )
    }
    const readCache = localStorage.getCachedAppInfo
    const writeCache = localStorage.setCachedAppInfo
    const readCacheSpy = vi
      .spyOn(localStorage, 'getCachedAppInfo')
      .mockImplementation((directory) => readCache(directory, storage))
    const writeCacheSpy = vi
      .spyOn(localStorage, 'setCachedAppInfo')
      .mockImplementation((options) => writeCache(options, storage))
    vi.mocked(build).mockImplementation(async ({app}) => ({status: 'success', appName: app.name}))
    vi.stubEnv('SHOPIFY_FLAG_NO_INPUT', '1')
    try {
      localStorage.setCachedAppInfo({directory, configFile: 'shopify.app.deleted.toml'})
      const config = await Config.load({root: joinPath(dirname(fileURLToPath(import.meta.url)), '../../../..')})
      const argv = ['--path', directory, '--json', '--no-input']
      const command = new Build(argv, config)
      await withCapturedStandardStreams(async ({stdout, stderr}) => {
        const run = runWithCommandEventsForCommand(argv, () => command.run())
        if (multiple) {
          await expect(run).rejects.toThrow('Failed to prompt')
          expect(stdout()).toBe('')
          expect(build).not.toHaveBeenCalled()
          expect(localStorage.getCachedAppInfo(directory)?.configFile).toBe('shopify.app.deleted.toml')
          return
        }
        await run
        expect(JSON.parse(stdout())).toStrictEqual({status: 'success'})
        expect(
          stderr()
            .trim()
            .split('\n')
            .map((line) => JSON.parse(line)),
        ).toContainEqual(
          expect.objectContaining({
            type: 'diagnostic',
            level: 'warning',
            message: expect.stringContaining("Couldn't find shopify.app.deleted.toml"),
          }),
        )
      })
      if (!multiple) {
        expect(vi.mocked(build).mock.calls[0]![0].app.configPath).toBe(joinPath(directory, 'shopify.app.toml'))
        expect(localStorage.getCachedAppInfo(directory)?.configFile).toBe('shopify.app.toml')
      }
    } finally {
      readCacheSpy.mockRestore()
      writeCacheSpy.mockRestore()
      vi.unstubAllEnvs()
    }
  })
})
