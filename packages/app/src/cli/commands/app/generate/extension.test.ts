import AppGenerateExtension from './extension.js'
import generate from '../../../services/generate.js'
import {GenerateExtensionResult} from '../../../services/generate/extension/types.js'
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
import {AbortError} from '@shopify/cli-kit/node/error'
import {inTemporaryDirectory, rmdir, tempDirectory, writeFile} from '@shopify/cli-kit/node/fs'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {cwd, joinPath, relativePath} from '@shopify/cli-kit/node/path'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {describeJsonCommand} from '@shopify/cli-kit/node/testing/json-command'
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

async function configureApp(directory: string): Promise<GenerateExtensionResult> {
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
  return result
}

async function withApp(run: (directory: string, result: GenerateExtensionResult) => Promise<void>) {
  vi.stubGlobal('console', {...globalThis.console, Console})
  await inTemporaryDirectory(async (directory) => {
    await run(directory, await configureApp(directory))
  })
}

async function runCommand(directory: string, flags: string[]) {
  const argv = ['--path', directory, '--template', 'checkout_ui', '--name', 'My extension', ...flags]
  const command = new AppGenerateExtension(argv, await Config.load())
  return runWithCommandEventsForCommand(argv, () => command.run())
}

test('keeps app and inherited flags', () => {
  expect(AppGenerateExtension.flags.path).toBe(appFlags.path)
  expect(AppGenerateExtension.baseFlags['auth-alias']).toBeDefined()
})

test.each([{flags: ['--flavor', 'preact']}, {flags: ['--flavor=preact']}])(
  'accepts an explicit Preact flavor non-interactively with $flags',
  async ({flags}) => {
    await withApp(async (directory) => {
      await withCapturedStandardStreams(async () => {
        await runCommand(directory, ['--no-input', ...flags])
      })
      expect(generate).toHaveBeenCalledWith(expect.objectContaining({flavor: 'preact'}))
    })
  },
)

test.each(['vanilla-js', 'react', 'typescript', 'typescript-react', 'rust', 'wasm', 'liquid', 'config-only'])(
  'accepts the known flavor %s',
  async (flavor) => {
    await withApp(async (directory) => {
      await withCapturedStandardStreams(async () => {
        await runCommand(directory, ['--no-input', '--flavor', flavor])
        await runCommand(directory, ['--no-input', `--flavor=${flavor}`])
      })
      expect(generate).toHaveBeenNthCalledWith(1, expect.objectContaining({flavor}))
      expect(generate).toHaveBeenNthCalledWith(2, expect.objectContaining({flavor}))
    })
  },
)

test.each(['', 'future-flavor', 'precat'])('rejects flavor %j before loading the app or generating', async (flavor) => {
  await withApp(async (directory) => {
    await withCapturedStandardStreams(async () => {
      await expect(runCommand(directory, ['--no-input', '--flavor', flavor])).rejects.toThrow('to be one of:')
      await expect(runCommand(directory, ['--no-input', `--flavor=${flavor}`])).rejects.toThrow('to be one of:')
    })
    expect(linkedAppContext).not.toHaveBeenCalled()
    expect(generate).not.toHaveBeenCalled()
  })
})

test('accepts a known flavor from the environment', async () => {
  vi.stubEnv('SHOPIFY_FLAG_FLAVOR', 'liquid')
  await withApp(async (directory) => {
    await withCapturedStandardStreams(async () => {
      await runCommand(directory, ['--no-input'])
    })
    expect(generate).toHaveBeenCalledWith(expect.objectContaining({flavor: 'liquid'}))
  })
})

test.each(['future-flavor', 'precat'])(
  'rejects unknown environment flavor %j before loading the app',
  async (flavor) => {
    vi.stubEnv('SHOPIFY_FLAG_FLAVOR', flavor)
    await withApp(async (directory) => {
      await withCapturedStandardStreams(async () => {
        await expect(runCommand(directory, ['--no-input'])).rejects.toThrow('to be one of:')
      })
      expect(linkedAppContext).not.toHaveBeenCalled()
      expect(generate).not.toHaveBeenCalled()
    })
  },
)

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

let extensionDirectory: string
let extensionFixture: GenerateExtensionResult

describeJsonCommand({
  command: AppGenerateExtension,
  commandId: 'app:generate:extension',
  moduleURL: new URL('../../../../../../cli/bin/dev.js', import.meta.url).href,
  args: () => ['--path', extensionDirectory, '--template', 'checkout_ui', '--name', 'My extension'],
  expectedResult: () => ({
    status: 'success',
    extension: {
      name: 'My extension',
      type: 'ui_extension',
      template: 'checkout_ui',
      flavor: 'typescript-react',
      directory: joinPath(extensionDirectory, 'extensions', 'my-extension'),
    },
  }),
  expectedSchema: {
    type: 'object',
    properties: {extension: {$ref: '#/definitions/GeneratedExtension'}},
    required: ['status', 'extension'],
    additionalProperties: false,
  },
  setup: async () => {
    extensionDirectory = tempDirectory()
    extensionFixture = await configureApp(extensionDirectory)
    const fixtureDirectory = extensionDirectory
    return () => rmdir(fixtureDirectory)
  },
  assertExecuted: () => {
    expect(linkedAppContext).toHaveBeenCalledExactlyOnceWith({
      directory: extensionDirectory,
      clientId: undefined,
      forceRelink: false,
      userProvidedConfigName: undefined,
    })
    expect(generate).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({name: 'My extension', template: 'checkout_ui'}),
    )
  },
  assertNotExecuted: () => {
    expect(linkedAppContext).not.toHaveBeenCalled()
    expect(generate).not.toHaveBeenCalled()
  },
  textOutput: ({stdout, stderr}) => {
    expect(stdout).toBe('')
    expect(stderr.replace(/[│\s]/g, '')).toContain(
      `Your extension was created in ${extensionFixture.extension.directory}`.replace(/\s/g, ''),
    )
    expect(stderr).toContain('pnpm shopify app dev')
    expect(stderr).toContain(checkoutUITemplate.supportLinks[0])
  },
  diagnostics: {
    setup: () => {
      const result = extensionFixture
      vi.mocked(generate).mockImplementation(async () => {
        outputInfo('Generating extension.')
        return result
      })
    },
    expectedEvents: [{type: 'diagnostic', level: 'info', message: 'Generating extension.'}],
  },
  failure: {
    setup: () => {
      vi.mocked(generate).mockRejectedValue(new AbortError('Template download failed.'))
    },
    expectedError: {error: {type: 'abort', message: 'Template download failed.'}},
    exitCode: 1,
  },
})
