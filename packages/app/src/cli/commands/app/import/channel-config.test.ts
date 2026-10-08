import ImportChannelConfig from './channel-config.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {importChannelConfigJsonOutputSchema} from '../../../services/import-channel-config/types.js'
import {
  CHANNEL_SPEC_DIRECTORY,
  CHANNEL_SPEC_EXTENSION_DIRECTORY,
} from '../../../services/import-channel-config/import.js'
import {testAppLinked, testDeveloperPlatformClient, testOrganizationApp} from '../../../models/app/app.test-data.js'
import {Config} from '@oclif/core'
import {inTemporaryDirectory, readFile} from '@shopify/cli-kit/node/fs'
import {dirname, joinPath} from '@shopify/cli-kit/node/path'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {expect, test, vi} from 'vitest'
import {fileURLToPath} from 'node:url'

vi.mock('../../../services/app-context.js')

const TOML = 'handle = "example"\nlabel = "Café channel"\n'
const warning = {code: 'missing_countries', message: 'Add a countries section.'}

test('imports real files and writes one JSON document with warning events on stderr', async () => {
  await inTemporaryDirectory(async (tmp) => {
    const app = testAppLinked({directory: tmp})
    const developerPlatformClient = testDeveloperPlatformClient({
      channelSpecExport: async () => ({
        ok: true,
        status: 200,
        body: {handle: 'example', filename: 'example.toml', toml: TOML, warnings: [{...warning, internal: 'private'}]},
      }),
    })
    vi.mocked(linkedAppContext).mockResolvedValue({
      app,
      remoteApp: testOrganizationApp(),
      developerPlatformClient,
    } as unknown as Awaited<ReturnType<typeof linkedAppContext>>)
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await runCommand(['--path', tmp, '--json'])
      const path = joinPath(tmp, CHANNEL_SPEC_DIRECTORY, 'example.toml')
      const result = JSON.parse(stdout())
      expect(result).toEqual({
        status: 'success',
        handle: 'example',
        filename: 'example.toml',
        path,
        toml: TOML,
        warnings: [warning],
      })
      expect(() =>
        importChannelConfigJsonOutputSchema.encode({...result, path: joinPath(CHANNEL_SPEC_DIRECTORY, 'example.toml')}),
      ).toThrow()
      expect(() => importChannelConfigJsonOutputSchema.encode({...result, internal: 'private'})).toThrow()
      expect(() =>
        importChannelConfigJsonOutputSchema.encode({...result, warnings: [{...warning, internal: 'private'}]}),
      ).toThrow()
      expect(JSON.parse(stderr())).toMatchObject({type: 'diagnostic', level: 'warning', message: warning.message})
      await expect(readFile(path)).resolves.toBe(TOML)
      await expect(readFile(joinPath(tmp, CHANNEL_SPEC_EXTENSION_DIRECTORY, 'shopify.extension.toml'))).resolves.toBe(
        'name = "Channel config"\ntype = "channel_config"\nhandle = "channel-config"\n',
      )
    })
  })
})

async function runCommand(argv: string[]) {
  const config = await Config.load({root: joinPath(dirname(fileURLToPath(import.meta.url)), '../../../../..')})
  // The installed CLI bundles this source package instead of loading it as a custom plugin.
  config.plugins.delete('@shopify/app')
  return ImportChannelConfig.run(argv, config)
}
