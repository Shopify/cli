import ImportChannelConfig from './channel-config.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {importChannelConfigJsonOutputSchema} from '../../../services/import-channel-config/types.js'
import {
  CHANNEL_SPEC_DIRECTORY,
  CHANNEL_SPEC_EXTENSION_DIRECTORY,
} from '../../../services/import-channel-config/import.js'
import {testAppLinked, testDeveloperPlatformClient, testOrganizationApp} from '../../../models/app/app.test-data.js'
import {Config} from '@oclif/core'
import {fileExists, inTemporaryDirectory, mkdir, readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {dirname, joinPath} from '@shopify/cli-kit/node/path'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {unstyled} from '@shopify/cli-kit/node/output'
import {afterEach, expect, test, vi} from 'vitest'
import {fileURLToPath} from 'node:url'
import type {ChannelSpecExportResponse} from '../../../utilities/developer-platform-client.js'

vi.mock('../../../services/app-context.js')

const TOML = 'handle = "example"\nlabel = "Café channel"\n'
const warning = {code: 'missing_countries', message: 'Add a countries section.'}

afterEach(() => {
  vi.unstubAllEnvs()
})

test('exposes its strict result schema and JSON flag in help', () => {
  expect(ImportChannelConfig.jsonOutputSchema).toBe(importChannelConfigJsonOutputSchema)
  expect(ImportChannelConfig.description).toContain('ImportChannelConfigResult')
  expect(ImportChannelConfig.flags.json.char).toBe('j')
  expect(importChannelConfigJsonOutputSchema.jsonSchema).toMatchObject({additionalProperties: false})
})

test('imports real files and writes one JSON document with warning events on stderr', async () => {
  await inTemporaryDirectory(async (tmp) => {
    const {app, developerPlatformClient} = setContext(tmp)
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      const commandResult = await runCommand(['--path', tmp, '--json', '--no-input'])
      const path = joinPath(tmp, CHANNEL_SPEC_DIRECTORY, 'example.toml')
      expect(JSON.parse(stdout())).toEqual({
        status: 'success',
        handle: 'example',
        filename: 'example.toml',
        path,
        toml: TOML,
        warnings: [warning],
      })
      expect(JSON.parse(stderr())).toMatchObject({type: 'diagnostic', level: 'warning', ...warning})
      expect(commandResult).toEqual({app})
      await expect(readFile(path)).resolves.toBe(TOML)
      await expect(readFile(joinPath(tmp, CHANNEL_SPEC_EXTENSION_DIRECTORY, 'shopify.extension.toml'))).resolves.toBe(
        'name = "Channel config"\ntype = "channel_config"\nhandle = "channel-config"\n',
      )
      expect(developerPlatformClient.channelSpecExport).toHaveBeenCalledOnce()
    })
  })
})

test('JSON without no-input uses the same context and does not imply force', async () => {
  await inTemporaryDirectory(async (tmp) => {
    setContext(tmp)
    await withCapturedStandardStreams(async ({stdout}) => {
      await runCommand(['--path', tmp, '--json'])
      expect(JSON.parse(stdout()).status).toBe('success')
      expect(linkedAppContext).toHaveBeenCalledWith({
        directory: tmp,
        clientId: undefined,
        forceRelink: false,
        userProvidedConfigName: undefined,
      })
    })
  })
})

test('no-input alone keeps the existing warning and success text', async () => {
  await inTemporaryDirectory(async (tmp) => {
    setContext(tmp)
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await runCommand(['--path', tmp, '--no-input'])
      expect(stdout()).toBe('')
      expect(unstyled(stderr())).toContain('Imported the channel spec for app1.')
      expect(unstyled(stderr())).toContain(warning.message)
      expect(unstyled(stderr())).toContain('Also created')
    })
  })
})

test('overwrite refusal emits one fatal document, preserves the file, and does not create extension metadata', async () => {
  vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
  const exit = vi.spyOn(process, 'exit')
  await inTemporaryDirectory(async (tmp) => {
    setContext(tmp)
    const path = joinPath(tmp, CHANNEL_SPEC_DIRECTORY, 'example.toml')
    await mkdir(dirname(path))
    await writeFile(path, 'existing = true\n')
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await expect(runCommand(['--path', tmp, '--json', '--no-input'])).rejects.toThrow()
      expect(JSON.parse(stdout())).toMatchObject({
        error: {type: 'abort', message: expect.stringContaining('already exists')},
      })
      expect(stderr()).toBe('')
      expect(exit).toHaveBeenCalledWith(1)
      await expect(readFile(path)).resolves.toBe('existing = true\n')
      await expect(fileExists(joinPath(tmp, CHANNEL_SPEC_EXTENSION_DIRECTORY, 'shopify.extension.toml'))).resolves.toBe(
        false,
      )
    })
  })
})

test('force replaces the existing file and returns its absolute path', async () => {
  await inTemporaryDirectory(async (tmp) => {
    setContext(tmp)
    const path = joinPath(tmp, CHANNEL_SPEC_DIRECTORY, 'example.toml')
    await mkdir(dirname(path))
    await writeFile(path, 'existing = true\n')
    await withCapturedStandardStreams(async ({stdout}) => {
      await runCommand(['--path', tmp, '--json', '--no-input', '--force'])
      expect(JSON.parse(stdout()).path).toBe(path)
      await expect(readFile(path)).resolves.toBe(TOML)
    })
  })
})

test.each([
  {ok: false as const, status: 422, body: {reason: 'not_allowlisted'}},
  {ok: false as const, status: 401, body: {}},
  {ok: true as const, status: 200, body: {handle: 'example'}},
])('export failure emits one fatal document without writing a file: %j', async (response) => {
  vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
  const exit = vi.spyOn(process, 'exit')
  await inTemporaryDirectory(async (tmp) => {
    setContext(tmp, response)
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await expect(runCommand(['--path', tmp, '--json', '--no-input'])).rejects.toThrow()
      expect(JSON.parse(stdout())).toMatchObject({error: {type: 'abort'}})
      expect(stderr()).toBe('')
      expect(exit).toHaveBeenCalledWith(1)
      await expect(fileExists(joinPath(tmp, CHANNEL_SPEC_EXTENSION_DIRECTORY))).resolves.toBe(false)
    })
  })
})

function setContext(
  directory: string,
  response: ChannelSpecExportResponse = {
    ok: true,
    status: 200,
    body: {handle: 'example', filename: 'example.toml', toml: TOML, warnings: [warning]},
  },
) {
  const app = testAppLinked({directory})
  const developerPlatformClient = testDeveloperPlatformClient({channelSpecExport: async () => response})
  vi.mocked(linkedAppContext).mockResolvedValue({
    app,
    remoteApp: testOrganizationApp(),
    developerPlatformClient,
  } as unknown as Awaited<ReturnType<typeof linkedAppContext>>)
  return {app, developerPlatformClient}
}

async function runCommand(argv: string[]) {
  const config = await Config.load({root: joinPath(dirname(fileURLToPath(import.meta.url)), '../../../../..')})
  // The installed CLI bundles this source package instead of loading it as a custom plugin.
  config.plugins.delete('@shopify/app')
  return ImportChannelConfig.run(argv, config)
}
