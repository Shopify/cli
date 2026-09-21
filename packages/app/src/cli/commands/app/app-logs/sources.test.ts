import {testAppLinked, testFunctionExtension} from '../../../models/app/app.test-data.js'
import {AppErrors} from '../../../models/app/loader.js'
import {Config} from '@oclif/core'
import {afterEach, expect, test, vi} from 'vitest'
import {formatSection} from '@shopify/cli-kit/node/output'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
// eslint-disable-next-line n/prefer-global/console
import {Console} from 'node:console'

vi.mock('../../../services/app-context.js')

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

async function runCommand(argv: string[], app = testAppLinked()) {
  const {linkedAppContext} = await import('../../../services/app-context.js')
  vi.mocked(linkedAppContext).mockResolvedValue({app} as Awaited<ReturnType<typeof linkedAppContext>>)
  const {default: Sources} = await import('./sources.js')
  return new Sources(argv, await Config.load()).run()
}

test('writes one JSON document to stdout without terminal text', async () => {
  process.env.SHOPIFY_UNIT_TEST = 'false'
  vi.resetModules()
  const app = testAppLinked({
    allExtensions: [
      await testFunctionExtension({config: {...(await testFunctionExtension()).configuration, handle: 'discount'}}),
    ],
  })
  const streams = captureStandardStreams()
  try {
    await expect(runCommand(['--json'], app)).resolves.toEqual({app})
  } finally {
    streams.restore()
  }
  const extension = app.allExtensions[0]!
  expect(JSON.parse(streams.stdout())).toEqual([
    {
      source: 'extensions.discount',
      namespace: 'extensions',
      handle: 'discount',
      name: extension.configuration.name,
      type: extension.type,
      externalType: extension.externalType,
      humanName: extension.humanName,
      uid: extension.uid,
      directory: extension.directory,
      configurationPath: extension.configurationPath,
      configuration: extension.configuration,
      entrySourceFilePath: extension.entrySourceFilePath,
      outputPath: extension.outputPath,
      surface: extension.surface,
      features: extension.features,
      ...(extension.dependency === undefined ? {} : {dependency: extension.dependency}),
    },
  ])
  expect(streams.stderr()).toBe('')
})

test('writes an empty JSON array when no sources exist', async () => {
  process.env.SHOPIFY_UNIT_TEST = 'false'
  vi.resetModules()
  const streams = captureStandardStreams()
  try {
    await runCommand(['--json'])
  } finally {
    streams.restore()
  }
  expect(streams.stdout()).toBe('[]\n')
  expect(streams.stderr()).toBe('')
})

test('keeps namespace sections on stdout in text mode', async () => {
  process.env.SHOPIFY_UNIT_TEST = 'false'
  vi.resetModules()
  const app = testAppLinked({
    allExtensions: [
      await testFunctionExtension({config: {...(await testFunctionExtension()).configuration, handle: 'discount'}}),
    ],
  })
  const streams = captureStandardStreams()
  try {
    await runCommand([], app)
  } finally {
    streams.restore()
  }
  expect(streams.stdout()).toBe(`${formatSection('extensions', 'extensions.discount')}\n`)
  expect(streams.stderr()).toBe('')
})

test.each([{argv: []}, {argv: ['--json']}])(
  'exits with status 2 before output for invalid apps (%j)',
  async ({argv}) => {
    const errors = new AppErrors()
    errors.addError({file: 'shopify.app.toml', message: 'Invalid app'})
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('exit')
    })
    try {
      await expect(runCommand(argv, testAppLinked({errors}))).rejects.toThrow('exit')
      expect(exit).toHaveBeenCalledWith(2)
      expect(mockAndCaptureOutput().output()).toBe('')
    } finally {
      exit.mockRestore()
    }
  },
)

test('exposes the schema in help', async () => {
  const {default: Sources} = await import('./sources.js')
  const {appLogSourcesJsonOutputSchema} = await import('../../../services/app-logs/sources/types.js')
  expect(Sources.jsonOutputSchema).toBe(appLogSourcesJsonOutputSchema)
  expect(Sources.descriptionForHelp()).toContain('`AppLogSourcesResult` schema')
})
