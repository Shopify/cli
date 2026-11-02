import ConfigUse from './use.js'
import * as localStorage from '../../../services/local-storage.js'
import {Config} from '@oclif/core'
import {expect, test, vi} from 'vitest'
import {inTemporaryDirectory, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {LocalStorage} from '@shopify/cli-kit/node/local-storage'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
// Match the platform-native public artifact path.
// eslint-disable-next-line no-restricted-imports
import {resolve} from 'node:path'

const {getCachedAppInfo, setCachedAppInfo, clearCurrentConfigFile} = localStorage

test.each([
  {previousConfigFile: 'shopify.app.deleted.toml', reset: false, changed: true},
  {previousConfigFile: 'shopify.app.toml', reset: false, changed: false},
  {previousConfigFile: undefined, reset: false, changed: true},
  {previousConfigFile: 'shopify.app.deleted.toml', reset: true, changed: true},
  {previousConfigFile: undefined, reset: true, changed: false},
])('compares the final preference with command entry: %j', async ({previousConfigFile, reset, changed}) => {
  await inTemporaryDirectory(async (directory) => {
    const storage = new LocalStorage<localStorage.AppLocalStorageSchema>({cwd: joinPath(directory, 'storage')})
    vi.spyOn(localStorage, 'getCachedAppInfo').mockImplementation((path) => getCachedAppInfo(path, storage))
    vi.spyOn(localStorage, 'setCachedAppInfo').mockImplementation((options) => setCachedAppInfo(options, storage))
    vi.spyOn(localStorage, 'clearCurrentConfigFile').mockImplementation((path) => clearCurrentConfigFile(path, storage))
    setCachedAppInfo({directory, configFile: previousConfigFile}, storage)
    await writeFile(joinPath(directory, 'package.json'), '{}')
    await writeFile(
      joinPath(directory, 'shopify.app.toml'),
      `name = "test-app"
client_id = "test-client-id"
application_url = "https://example.com"
embedded = true
[auth]
redirect_urls = ["https://example.com/callback"]
[webhooks]
api_version = "2026-01"
`,
    )
    const args = ['--path', directory, '--json', '--no-input', ...(reset ? ['--reset'] : [])]
    const command = new ConfigUse(args, await Config.load())

    await withCapturedStandardStreams(async (streams) => {
      await command.run()

      expect(JSON.parse(streams.stdout())).toEqual({
        status: 'success',
        changed,
        path: reset ? null : resolve(directory, 'shopify.app.toml'),
        clientId: reset ? null : 'test-client-id',
      })
    })
    expect(getCachedAppInfo(directory, storage)?.configFile).toBe(reset ? undefined : 'shopify.app.toml')
  })
})
