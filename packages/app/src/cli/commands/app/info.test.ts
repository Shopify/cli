import AppInfo from './info.js'
import {testAppLinked, testOrganizationApp, testProject} from '../../models/app/app.test-data.js'
import {AppErrors} from '../../models/app/loader.js'
import {OrganizationSource} from '../../models/organization.js'
import {linkedAppContext} from '../../services/app-context.js'
import {appInfoJsonOutputSchema} from '../../services/info/types.js'
import {Config} from '@oclif/core'
import {afterEach, expect, test, vi} from 'vitest'
import {mockAndCaptureOutput, withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {unstyled, outputInfo} from '@shopify/cli-kit/node/output'
import {platformAndArch} from '@shopify/cli-kit/node/os'
import {CLI_KIT_VERSION} from '@shopify/cli-kit/common/version'
import {describeJsonCommand} from '@shopify/cli-kit/node/testing/json-command'

vi.mock('../../services/app-context.js')
vi.mock('../../services/context.js')

afterEach(() => {
  mockAndCaptureOutput().clear()
})

async function runCommand(argv: string[], app = testAppLinked(), remoteApp = testOrganizationApp()) {
  const developerPlatformClient = remoteApp.developerPlatformClient
  vi.spyOn(developerPlatformClient, 'accountInfo')
  vi.mocked(linkedAppContext).mockResolvedValue({
    app,
    remoteApp,
    project: testProject(),
    organization: {id: '123', businessName: 'Example organization', source: OrganizationSource.BusinessPlatform},
    developerPlatformClient,
  } as unknown as Awaited<ReturnType<typeof linkedAppContext>>)
  const result = await new AppInfo(argv, await Config.load()).run()
  return {result, developerPlatformClient}
}

test.each([{secret: 'api-secret'}, {secret: undefined}])(
  'preserves web environment JSON: $secret',
  async ({secret}) => {
    const remoteApp = testOrganizationApp({apiSecretKeys: secret === undefined ? [] : [{secret}]})
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await runCommand(['--web-env', '--json'], testAppLinked(), remoteApp)
      expect(stdout()).toBe(
        secret === undefined
          ? '{\n  "SHOPIFY_API_KEY": "api-key",\n  "SCOPES": "read_products"\n}\n'
          : '{\n  "SHOPIFY_API_KEY": "api-key",\n  "SHOPIFY_API_SECRET": "api-secret",\n  "SCOPES": "read_products"\n}\n',
      )
      expect(stderr()).toBe('')
    })
  },
)

test('keeps web environment text on stdout, with an empty missing secret', async () => {
  await withCapturedStandardStreams(async ({stdout, stderr}) => {
    await runCommand(['--web-env'], testAppLinked(), testOrganizationApp({apiSecretKeys: []}))
    expect(unstyled(stdout())).toBe(
      '\n    SHOPIFY_API_KEY=api-key\n    SHOPIFY_API_SECRET=\n    SCOPES=read_products\n  \n',
    )
    expect(stderr()).toBe('')
  })
})

test.each([{argv: []}, {argv: ['--json']}, {argv: ['--web-env', '--json']}])(
  'prints the result before exiting with status 2: $argv',
  async ({argv}) => {
    const errors = new AppErrors()
    errors.addError({file: '/tmp/project/shopify.app.toml', message: 'Invalid app'})
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('exit')
    })
    try {
      await withCapturedStandardStreams(async ({stdout, stderr}) => {
        await expect(runCommand(argv, testAppLinked({errors}))).rejects.toThrow('exit')
        expect(exit).toHaveBeenCalledWith(2)
        if (argv.includes('--json')) {
          expect(JSON.parse(stdout())).toBeDefined()
          expect(stderr()).toBe('')
        } else {
          expect(stdout()).toBe('')
          expect(stderr()).toContain('CURRENT APP CONFIGURATION')
        }
      })
    } finally {
      exit.mockRestore()
    }
  },
)

test('preserves context failures without printing a result', async () => {
  vi.mocked(linkedAppContext).mockRejectedValue(new Error('Unable to load app'))
  await expect(new AppInfo(['--json'], await Config.load()).run()).rejects.toThrow('Unable to load app')
  expect(mockAndCaptureOutput().output()).toBe('')
})

test('exposes both app and web environment schemas in help', () => {
  expect(AppInfo.jsonOutputSchema).toBe(appInfoJsonOutputSchema)
  expect(AppInfo.descriptionForHelp()).toContain('`AppInfoResult` schema')
  expect(AppInfo.descriptionForHelp()).toContain('AppInfoWebEnvironment')
})

test('renders text without constructing or validating the public JSON result', async () => {
  const validate = vi.spyOn(appInfoJsonOutputSchema, 'validate').mockImplementation(() => {
    throw new Error('JSON validation failed')
  })
  const app = testAppLinked()
  Object.defineProperty(app, 'specifications', {
    get() {
      throw new Error('JSON-only metadata must not be read')
    },
  })
  try {
    await withCapturedStandardStreams(async ({stderr}) => {
      const {developerPlatformClient} = await runCommand([], app)
      expect(validate).not.toHaveBeenCalled()
      expect(developerPlatformClient.accountInfo).toHaveBeenCalledOnce()
      expect(stderr()).toContain('CURRENT APP CONFIGURATION')
      await expect(runCommand(['--json'])).rejects.toThrow('JSON validation failed')
    })
  } finally {
    validate.mockRestore()
  }
})

let fixtureApp: ReturnType<typeof testAppLinked>
let client: ReturnType<typeof testOrganizationApp>['developerPlatformClient']

function setupInfo() {
  fixtureApp = testAppLinked()
  const remoteApp = testOrganizationApp()
  client = remoteApp.developerPlatformClient
  vi.spyOn(client, 'accountInfo')
  vi.mocked(linkedAppContext).mockResolvedValue({
    app: fixtureApp,
    remoteApp,
    project: testProject(),
    organization: {id: '123', businessName: 'Example organization', source: OrganizationSource.BusinessPlatform},
    developerPlatformClient: client,
  } as unknown as Awaited<ReturnType<typeof linkedAppContext>>)
}

describeJsonCommand({
  command: AppInfo,
  commandId: 'app:info',
  moduleURL: new URL('../../../../../cli/bin/dev.js', import.meta.url).href,
  args: [],
  expectedResult: () => ({
    remoteApp: {id: '1', title: 'app1', apiKey: 'api-key', organizationId: '1', grantedScopes: [], flags: []},
    account: {type: 'UserAccount', email: 'partner@shopify.com'},
    project: {
      directory: '/tmp/project',
      appConfigFiles: [],
      extensionConfigFiles: [],
      webConfigFiles: [],
      dotenvFiles: [],
      errors: [],
    },
    system: {
      cliVersion: CLI_KIT_VERSION,
      nodeVersion: process.version,
      ...platformAndArch(),
      ...(process.env.SHELL === undefined ? {} : {shell: process.env.SHELL}),
    },
    name: 'App',
    idEnvironmentVariableName: 'SHOPIFY_API_KEY',
    directory: '/tmp/project',
    configPath: '/tmp/project/shopify.app.toml',
    configuration: fixtureApp.configuration,
    webs: fixtureApp.webs,
    errors: {errors: []},
    specifications: [],
    remoteFlags: [],
    realExtensions: [],
    _hiddenConfig: {},
    packageManager: 'yarn',
    nodeDependencies: {},
    usesWorkspaces: false,
    organization: {id: '123', businessName: 'Example organization', source: OrganizationSource.BusinessPlatform},
    allExtensions: [],
  }),
  expectedSchema: {anyOf: expect.any(Array)},
  setup: setupInfo,
  assertExecuted: () => {
    expect(linkedAppContext).toHaveBeenCalledOnce()
    expect(client.accountInfo).toHaveBeenCalledExactlyOnceWith()
  },
  assertNotExecuted: () => {
    expect(linkedAppContext).not.toHaveBeenCalled()
    expect(client.accountInfo).not.toHaveBeenCalled()
  },
  textOutput: ({stdout, stderr}) => {
    expect(stdout).toBe('')
    expect(stderr).toContain('CURRENT APP CONFIGURATION')
    expect(stderr).toContain('Example organization (123)')
    expect(stderr).toContain('TOOLING AND SYSTEM')
  },
  diagnostics: {
    setup: () => {
      vi.mocked(linkedAppContext).mockImplementationOnce(async (options) => {
        outputInfo('Loading app configuration')
        return vi.mocked(linkedAppContext).getMockImplementation()!(options)
      })
    },
    expectedEvents: [{type: 'diagnostic', level: 'info', message: 'Loading app configuration'}],
  },
})

describeJsonCommand({
  command: AppInfo,
  commandId: 'app:info',
  moduleURL: new URL('../../../../../cli/bin/dev.js', import.meta.url).href,
  args: ['--web-env'],
  expectedResult: {SHOPIFY_API_KEY: 'api-key', SHOPIFY_API_SECRET: 'api-secret', SCOPES: 'read_products'},
  expectedSchema: {anyOf: expect.any(Array)},
  setup: setupInfo,
  assertExecuted: () => {
    expect(linkedAppContext).toHaveBeenCalledOnce()
    expect(client.accountInfo).not.toHaveBeenCalled()
  },
  assertNotExecuted: () => {
    expect(linkedAppContext).not.toHaveBeenCalled()
  },
  textOutput: ({stdout, stderr}) => {
    expect(unstyled(stdout)).toBe(
      '\n    SHOPIFY_API_KEY=api-key\n    SHOPIFY_API_SECRET=api-secret\n    SCOPES=read_products\n  \n',
    )
    expect(stderr).toBe('')
  },
})
