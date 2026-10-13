import AppGenerateExtension from './extension.js'
import generate from '../../../services/generate.js'
import {
  appGenerateExtensionJsonOutputSchema,
  GenerateExtensionResult,
} from '../../../services/generate/extension/types.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {appFlags} from '../../../flags.js'
import {
  checkoutUITemplate,
  testAppLinked,
  testDeveloperPlatformClient,
  testOrganization,
  testOrganizationApp,
  testProject,
} from '../../../models/app/app.test-data.js'
import {Config} from '@oclif/core'
import {afterEach, expect, test, vi} from 'vitest'
import {runWithCommandEventsForCommand} from '@shopify/cli-kit/node/command-events'
import {launchCLI} from '@shopify/cli-kit/node/cli-launcher'
import {AbortError, handler} from '@shopify/cli-kit/node/error'
import {inTemporaryDirectory, writeFile} from '@shopify/cli-kit/node/fs'
import {outputInfo, unstyled} from '@shopify/cli-kit/node/output'
import {cwd, joinPath, relativePath} from '@shopify/cli-kit/node/path'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {TomlFile} from '@shopify/cli-kit/node/toml/toml-file'
// eslint-disable-next-line n/prefer-global/console
import {Console} from 'node:console'

vi.mock('../../../services/generate.js')
vi.mock('../../../services/app-context.js')
vi.mock('@shopify/cli-kit/node/is-global', () => ({currentProcessIsGlobal: () => false}))

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

async function withApp(run: (directory: string, result: GenerateExtensionResult) => Promise<void>) {
  vi.stubGlobal('console', {...globalThis.console, Console})
  await inTemporaryDirectory(async (directory) => {
    const configPath = joinPath(directory, 'shopify.app.toml')
    await writeFile(configPath, 'name = "Test app"\nclient_id = "test-client-id"\n')
    const app = testAppLinked({directory, configPath})
    vi.mocked(linkedAppContext).mockResolvedValue({
      app,
      project: testProject({directory}),
      remoteApp: testOrganizationApp(),
      organization: testOrganization(),
      activeConfig: {file: await TomlFile.read(configPath), source: 'default', isLinked: true, hiddenConfig: {}},
      specifications: [],
      developerPlatformClient: testDeveloperPlatformClient(),
    })
    const result: GenerateExtensionResult = {
      status: 'success',
      extension: {
        directory: relativePath(cwd(), joinPath(directory, 'extensions', 'my-extension')),
        extensionTemplate: checkoutUITemplate,
        name: 'My extension',
        flavor: 'typescript-react',
      },
      packageManager: 'pnpm',
    }
    vi.mocked(generate).mockResolvedValue(result)
    await run(directory, result)
  })
}

async function runCommand(directory: string, flags: string[]) {
  const argv = ['--path', directory, '--template', 'checkout_ui', '--name', 'My extension', ...flags]
  const command = new AppGenerateExtension(argv, await Config.load())
  return runWithCommandEventsForCommand(argv, () => command.run())
}

test('declares the domain schema and keeps app and inherited flags', () => {
  expect(AppGenerateExtension.flags.json).toBeDefined()
  expect(AppGenerateExtension.flags.path).toBe(appFlags.path)
  expect(AppGenerateExtension.baseFlags).toHaveProperty('json-schema')
  expect(AppGenerateExtension.baseFlags['auth-alias']).toBeDefined()
  expect(AppGenerateExtension.jsonOutputSchema).toBe(appGenerateExtensionJsonOutputSchema)
  expect(AppGenerateExtension.descriptionForHelp()).toContain('AppGenerateExtensionResult')
})

test.each([
  {flags: ['--json'], environment: false},
  {flags: ['-j'], environment: false},
  {flags: ['--no-input'], environment: true},
])('writes one public JSON result for $flags with diagnostics on stderr', async ({flags, environment}) => {
  if (environment) vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
  await withApp(async (directory, result) => {
    vi.mocked(generate).mockImplementation(async () => {
      outputInfo('Generating extension.')
      return result
    })
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      const commandResult = await runCommand(directory, flags)
      expect(commandResult.app.directory).toBe(directory)
      expect(JSON.parse(stdout())).toEqual({
        status: 'success',
        extension: {
          name: 'My extension',
          type: 'ui_extension',
          template: 'checkout_ui',
          flavor: 'typescript-react',
          directory: joinPath(directory, 'extensions', 'my-extension'),
        },
      })
      expect(JSON.parse(stderr())).toMatchObject({type: 'diagnostic', level: 'info', message: 'Generating extension.'})
    })
    expect(generate).toHaveBeenCalledWith(expect.objectContaining({name: 'My extension', template: 'checkout_ui'}))
  })
})

test.each(['preact', 'liquid', 'config-only', undefined] as const)(
  'encodes the selected flavor without template internals: %s',
  async (flavor) => {
    await withApp(async (directory, result) => {
      result.extension.flavor = flavor
      await withCapturedStandardStreams(async ({stdout, stderr}) => {
        await runCommand(directory, ['--json'])
        expect(JSON.parse(stdout()).extension).toEqual({
          name: 'My extension',
          type: 'ui_extension',
          template: 'checkout_ui',
          flavor: flavor ?? null,
          directory: joinPath(directory, 'extensions', 'my-extension'),
        })
        expect(stderr()).toBe('')
      })
    })
  },
)

test('keeps the relative directory, success guidance, and documentation in text mode with no-input', async () => {
  await withApp(async (directory, result) => {
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await runCommand(directory, ['--no-input'])
      expect(stdout()).toBe('')
      const text = unstyled(stderr())
      expect(text.replace(/[│\s]/g, '')).toContain(
        `Your extension was created in ${result.extension.directory}`.replace(/\s/g, ''),
      )
      expect(text).toContain('pnpm shopify app dev')
      expect(text).toContain(checkoutUITemplate.supportLinks[0])
    })
  })
})

test('resolves the generated directory relative to the original package-manager working directory', async () => {
  await withApp(async (directory, result) => {
    vi.stubEnv('INIT_CWD', directory)
    result.extension.directory = joinPath('extensions', 'my-extension')
    await withCapturedStandardStreams(async ({stdout}) => {
      await runCommand(directory, ['--json'])
      expect(JSON.parse(stdout()).extension.directory).toBe(joinPath(directory, 'extensions', 'my-extension'))
    })
  })
})

test('preserves a generation failure and emits one fatal document without a success result', async () => {
  vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
  await withApp(async (directory) => {
    vi.mocked(generate).mockRejectedValueOnce(new AbortError('Template download failed.'))
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await runCommand(directory, ['--json']).catch(handler)
      expect(JSON.parse(stdout())).toEqual({error: {type: 'abort', message: 'Template download failed.'}})
      expect(stderr()).toBe('')
    })
  })
})

test('prints the JSON schema before loading the app or generating an extension', async () => {
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await launchCLI({
      moduleURL: new URL('../../../../../../cli/package.json', import.meta.url).href,
      argv: ['app', 'generate', 'extension', '--json-schema'],
      lazyCommandLoader: async (id) => (id === 'app:generate:extension' ? AppGenerateExtension : undefined),
    })
    expect(JSON.parse(stdout()).definitions.Result).toMatchObject({type: 'object', additionalProperties: false})
    expect(stderr()).toBe('')
    expect(linkedAppContext).not.toHaveBeenCalled()
    expect(generate).not.toHaveBeenCalled()
  })
})
