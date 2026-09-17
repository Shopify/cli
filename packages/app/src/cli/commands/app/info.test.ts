import {
  testAppLinked,
  testOrganizationApp,
  testProject,
  testDeveloperPlatformClient,
} from '../../models/app/app.test-data.js'
import {AppErrors} from '../../models/app/loader.js'
import {OrganizationSource} from '../../models/organization.js'
import {Config} from '@oclif/core'
import {afterEach, expect, test, vi} from 'vitest'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {runWithCommandEventsForCommand} from '@shopify/cli-kit/node/command-events'
import {unstyled, outputInfo} from '@shopify/cli-kit/node/output'
// eslint-disable-next-line n/prefer-global/console
import {Console} from 'node:console'

vi.mock('../../services/app-context.js')
vi.mock('../../services/context.js')

const originalUnitTestEnvironment = process.env.SHOPIFY_UNIT_TEST

afterEach(() => {
  if (originalUnitTestEnvironment === undefined) {
    delete process.env.SHOPIFY_UNIT_TEST
  } else {
    process.env.SHOPIFY_UNIT_TEST = originalUnitTestEnvironment
  }
  mockAndCaptureOutput().clear()
  vi.resetModules()
})

// Captures the real standard streams so JSON and text output are proven at the process boundary.
function captureStandardStreams() {
  const stdout: string[] = []
  const stderr: string[] = []

  const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: string | Uint8Array) => {
    stdout.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'))
    return true
  }) as typeof process.stdout.write)
  const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(((chunk: string | Uint8Array) => {
    stderr.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'))
    return true
  }) as typeof process.stderr.write)
  // Vitest intercepts console.warn; use Node's console to exercise the captured streams.
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(new Console(process.stdout, process.stderr).warn)

  return {
    stdout: () => stdout.join(''),
    stderr: () => stderr.join(''),
    restore: () => {
      warnSpy.mockRestore()
      stdoutSpy.mockRestore()
      stderrSpy.mockRestore()
    },
  }
}

async function runCommand(argv: string[], app = testAppLinked(), remoteApp = testOrganizationApp()) {
  const {linkedAppContext} = await import('../../services/app-context.js')
  const developerPlatformClient = testDeveloperPlatformClient()
  vi.spyOn(developerPlatformClient, 'accountInfo')
  vi.mocked(linkedAppContext).mockResolvedValue({
    app,
    remoteApp,
    project: testProject(),
    organization: {id: '123', businessName: 'Example organization', source: OrganizationSource.BusinessPlatform},
    developerPlatformClient,
  } as unknown as Awaited<ReturnType<typeof linkedAppContext>>)
  const {default: AppInfo} = await import('./info.js')
  const result = await new AppInfo(argv, await Config.load()).run()
  return {result, developerPlatformClient}
}

test('writes one JSON document with no account lookup or terminal output', async () => {
  process.env.SHOPIFY_UNIT_TEST = 'false'
  vi.resetModules()
  const app = testAppLinked()
  const streams = captureStandardStreams()
  try {
    const {result, developerPlatformClient} = await runCommand(['--json'], app)
    expect(result).toEqual({app})
    expect(developerPlatformClient.accountInfo).not.toHaveBeenCalled()
  } finally {
    streams.restore()
  }
  expect(JSON.parse(streams.stdout())).toEqual({
    name: 'App',
    idEnvironmentVariableName: 'SHOPIFY_API_KEY',
    directory: '/tmp/project',
    configPath: '/tmp/project/shopify.app.toml',
    configuration: app.configuration,
    webs: app.webs,
    errors: {errors: []},
    specifications: [],
    remoteFlags: [],
    realExtensions: [],
    _hiddenConfig: {},
    packageManager: 'yarn',
    nodeDependencies: {},
    usesWorkspaces: false,
    organization: {id: '123', businessName: 'Example organization'},
    allExtensions: [],
  })
  expect(streams.stderr()).toBe('')
})

test('keeps app information on stderr in text mode', async () => {
  process.env.SHOPIFY_UNIT_TEST = 'false'
  vi.resetModules()
  const streams = captureStandardStreams()
  try {
    const {developerPlatformClient} = await runCommand([])
    expect(developerPlatformClient.accountInfo).toHaveBeenCalledOnce()
  } finally {
    streams.restore()
  }
  expect(streams.stdout()).toBe('')
  expect(streams.stderr()).toContain('CURRENT APP CONFIGURATION')
  expect(streams.stderr()).toContain('Example organization (123)')
  expect(streams.stderr()).toContain('TOOLING AND SYSTEM')
})

test.each([{secret: 'api-secret'}, {secret: undefined}])(
  'preserves web environment JSON: $secret',
  async ({secret}) => {
    process.env.SHOPIFY_UNIT_TEST = 'false'
    vi.resetModules()
    const remoteApp = testOrganizationApp({apiSecretKeys: secret === undefined ? [] : [{secret}]})
    const streams = captureStandardStreams()
    try {
      await runCommand(['--web-env', '--json'], testAppLinked(), remoteApp)
    } finally {
      streams.restore()
    }
    expect(streams.stdout()).toBe(
      secret === undefined
        ? '{\n  "SHOPIFY_API_KEY": "api-key",\n  "SCOPES": "read_products"\n}\n'
        : '{\n  "SHOPIFY_API_KEY": "api-key",\n  "SHOPIFY_API_SECRET": "api-secret",\n  "SCOPES": "read_products"\n}\n',
    )
    expect(streams.stderr()).toBe('')
  },
)

test('keeps web environment text on stdout, with an empty missing secret', async () => {
  process.env.SHOPIFY_UNIT_TEST = 'false'
  vi.resetModules()
  const streams = captureStandardStreams()
  try {
    await runCommand(['--web-env'], testAppLinked(), testOrganizationApp({apiSecretKeys: []}))
  } finally {
    streams.restore()
  }
  expect(unstyled(streams.stdout())).toBe(
    '\n    SHOPIFY_API_KEY=api-key\n    SHOPIFY_API_SECRET=\n    SCOPES=read_products\n  \n',
  )
  expect(streams.stderr()).toBe('')
})

test.each([{argv: []}, {argv: ['--json']}, {argv: ['--web-env', '--json']}])(
  'prints the result before exiting with status 2: $argv',
  async ({argv}) => {
    process.env.SHOPIFY_UNIT_TEST = 'false'
    vi.resetModules()
    const errors = new AppErrors()
    errors.addError({file: '/tmp/project/shopify.app.toml', message: 'Invalid app'})
    const streams = captureStandardStreams()
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('exit')
    })
    try {
      await expect(runCommand(argv, testAppLinked({errors}))).rejects.toThrow('exit')
      expect(exit).toHaveBeenCalledWith(2)
    } finally {
      streams.restore()
      exit.mockRestore()
    }
    if (argv.includes('--json')) {
      expect(JSON.parse(streams.stdout())).toBeDefined()
      expect(streams.stderr()).toBe('')
    } else {
      expect(streams.stdout()).toBe('')
      expect(streams.stderr()).toContain('CURRENT APP CONFIGURATION')
    }
  },
)

test('preserves context failures without printing a result', async () => {
  const {linkedAppContext} = await import('../../services/app-context.js')
  vi.mocked(linkedAppContext).mockRejectedValue(new Error('Unable to load app'))
  const {default: AppInfo} = await import('./info.js')
  await expect(new AppInfo(['--json'], await Config.load()).run()).rejects.toThrow('Unable to load app')
  expect(mockAndCaptureOutput().output()).toBe('')
})

test('exposes both app and web environment schemas in help', async () => {
  const {default: AppInfo} = await import('./info.js')
  const {appInfoJsonOutputSchema} = await import('../../services/info/types.js')
  expect(AppInfo.jsonOutputSchema).toBe(appInfoJsonOutputSchema)
  expect(AppInfo.descriptionForHelp()).toContain('`AppInfoResult` schema')
  expect(AppInfo.descriptionForHelp()).toContain('AppInfoWebEnvironment')
})

test('routes context diagnostics through side events without contaminating the result', async () => {
  process.env.SHOPIFY_UNIT_TEST = 'false'
  vi.resetModules()
  const {linkedAppContext} = await import('../../services/app-context.js')
  const {default: AppInfo} = await import('./info.js')
  vi.mocked(linkedAppContext).mockImplementation(async () => {
    outputInfo('Loading app configuration')
    return {
      app: testAppLinked(),
      remoteApp: testOrganizationApp(),
      project: testProject(),
      organization: {id: '123', businessName: 'Example organization', source: OrganizationSource.BusinessPlatform},
      developerPlatformClient: testDeveloperPlatformClient(),
    } as unknown as Awaited<ReturnType<typeof linkedAppContext>>
  })
  const command = new AppInfo(['--json'], await Config.load())
  const streams = captureStandardStreams()
  try {
    await runWithCommandEventsForCommand(['--json'], () => command.run())
  } finally {
    streams.restore()
  }
  expect(JSON.parse(streams.stdout())).toHaveProperty('name', 'App')
  expect(JSON.parse(streams.stderr())).toMatchObject({
    type: 'diagnostic',
    level: 'info',
    message: 'Loading app configuration',
  })
})
