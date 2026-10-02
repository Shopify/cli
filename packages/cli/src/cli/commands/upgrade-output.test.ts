import Upgrade from './upgrade.js'
import {isDevelopment} from '@shopify/cli-kit/node/context/local'
import {currentProcessIsGlobal, inferPackageManagerForGlobalCLI, getProjectDir} from '@shopify/cli-kit/node/is-global'
import {exec} from '@shopify/cli-kit/node/system'
import {globalCLIVersion} from '@shopify/cli-kit/node/version'
import {
  checkForCachedNewVersion,
  checkForNewVersion,
  addNPMDependencies,
  getPackageManager,
} from '@shopify/cli-kit/node/node-package-manager'
import {CLI_KIT_VERSION} from '@shopify/cli-kit/common/version'
import {inTemporaryDirectory, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {ExternalError} from '@shopify/cli-kit/node/error'
import {upgradeJsonOutputSchema} from '@shopify/cli-kit/node/upgrade/types'
import {commandEventOutputSchema} from '@shopify/cli-kit/node/command-events'
import {afterEach, expect, onTestFinished, test, vi} from 'vitest'
// Vitest intercepts console.warn; exercise the real stderr writer.
// eslint-disable-next-line n/prefer-global/console
import {Console} from 'node:console'
import type {Writable} from 'node:stream'

vi.mock('@shopify/cli-kit/node/context/local', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/context/local')>()),
  isDevelopment: vi.fn(() => false),
}))
vi.mock('@shopify/cli-kit/node/is-global')
vi.mock('@shopify/cli-kit/node/system', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/system')>()),
  exec: vi.fn(),
}))
vi.mock('@shopify/cli-kit/node/version', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/version')>()),
  globalCLIVersion: vi.fn(),
}))
vi.mock('@shopify/cli-kit/node/node-package-manager', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/node-package-manager')>()),
  checkForCachedNewVersion: vi.fn(),
  checkForNewVersion: vi.fn(),
  addNPMDependencies: vi.fn(),
  getPackageManager: vi.fn(),
}))

function captureStreams() {
  const stdout: string[] = []
  const stderr: string[] = []
  vi.stubEnv('SHOPIFY_UNIT_TEST', 'false')
  const stdoutSpy = vi
    .spyOn(process.stdout, 'write')
    .mockImplementation(
      (
        chunk,
        encoding?: BufferEncoding | ((error?: Error | null) => void),
        callback?: (error?: Error | null) => void,
      ) => {
        stdout.push(String(chunk))
        if (typeof encoding === 'function') encoding()
        else callback?.()
        return true
      },
    )
  const stderrSpy = vi
    .spyOn(process.stderr, 'write')
    .mockImplementation(
      (
        chunk,
        encoding?: BufferEncoding | ((error?: Error | null) => void),
        callback?: (error?: Error | null) => void,
      ) => {
        stderr.push(String(chunk))
        if (typeof encoding === 'function') encoding()
        else callback?.()
        return true
      },
    )
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(new Console(process.stdout, process.stderr).warn)
  onTestFinished(() => {
    stdoutSpy.mockRestore()
    stderrSpy.mockRestore()
    warnSpy.mockRestore()
  })
  return {stdout: () => stdout.join(''), stderr: () => stderr.join('')}
}

afterEach(() => {
  vi.unstubAllEnvs()
  process.exitCode = 0
})

test('writes one global JSON result and package-manager diagnostics as stderr events', async () => {
  const streams = captureStreams()
  vi.mocked(currentProcessIsGlobal).mockReturnValue(true)
  vi.mocked(inferPackageManagerForGlobalCLI).mockReturnValue('npm')
  vi.mocked(globalCLIVersion).mockResolvedValue(CLI_KIT_VERSION)
  vi.mocked(exec).mockImplementation(async (_command, _args, options) => {
    expect(options?.stdin).toBe('inherit')
    ;(options?.stdout as Writable).write('installed packages\n')
    ;(options?.stderr as Writable).write('package manager warning\n')
  })

  await Upgrade.run(['--json'], import.meta.url)

  const expected = {
    status: 'upgraded',
    scope: 'global',
    previousVersion: CLI_KIT_VERSION,
    version: CLI_KIT_VERSION,
    packageManager: 'npm',
  }
  expect(streams.stdout()).toBe(`${JSON.stringify(expected, null, 2)}\n`)
  expect(upgradeJsonOutputSchema.validate(JSON.parse(streams.stdout()))).toEqual(expected)
  const events = streams
    .stderr()
    .trim()
    .split('\n')
    .map((line) => commandEventOutputSchema.validate(JSON.parse(line)))
  expect(events).toEqual(
    expect.arrayContaining([
      expect.objectContaining({type: 'diagnostic', message: 'installed packages\n'}),
      expect.objectContaining({type: 'diagnostic', message: 'package manager warning\n'}),
    ]),
  )
  expect(streams.stderr()).not.toContain('Shopify CLI upgraded.')
})

test('writes one local JSON result and routes dependency installation output through events', async () => {
  await inTemporaryDirectory(async (directory) => {
    await writeFile(
      joinPath(directory, 'package.json'),
      JSON.stringify({devDependencies: {'@shopify/cli-kit': '4.0.0'}}),
    )
    const streams = captureStreams()
    vi.mocked(currentProcessIsGlobal).mockReturnValue(false)
    vi.mocked(getProjectDir).mockReturnValue(directory)
    vi.mocked(checkForNewVersion).mockResolvedValue('4.9.0')
    vi.mocked(getPackageManager).mockResolvedValue('npm')
    vi.mocked(addNPMDependencies).mockImplementation(async (_dependencies, options) => {
      options.stdout?.write('updated dependency\n')
      options.stderr?.write('dependency warning\n')
    })

    await Upgrade.run(['--json'], import.meta.url)

    expect(JSON.parse(streams.stdout())).toEqual({
      status: 'dependencies_updated',
      scope: 'local',
      directory,
      previousVersion: '4.0.0',
      availableVersion: '4.9.0',
      packages: ['@shopify/cli-kit'],
    })
    expect(addNPMDependencies).toHaveBeenCalledWith(
      [{name: '@shopify/cli-kit', version: 'latest'}],
      expect.objectContaining({type: 'dev', directory}),
    )
    const events = streams
      .stderr()
      .trim()
      .split('\n')
      .map((line) => commandEventOutputSchema.validate(JSON.parse(line)))
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({type: 'diagnostic', message: 'updated dependency\n'}),
        expect.objectContaining({type: 'diagnostic', message: 'dependency warning\n'}),
      ]),
    )
  })
})

test('keeps development skip guidance on stderr and returns its reason on stdout', async () => {
  const streams = captureStreams()
  vi.mocked(isDevelopment).mockReturnValue(true)
  vi.mocked(currentProcessIsGlobal).mockReturnValue(true)

  await Upgrade.run(['--json'], import.meta.url)

  expect(JSON.parse(streams.stdout())).toEqual({status: 'skipped', reason: 'development', scope: 'global'})
  expect(JSON.parse(streams.stderr())).toMatchObject({
    type: 'diagnostic',
    message: 'Skipping upgrade in development mode.',
  })
  expect(exec).not.toHaveBeenCalled()
})

test.each(['install', 'verification'] as const)('preserves fatal JSON errors for %s failures', async (failure) => {
  const streams = captureStreams()
  // The shared fatal-error path inspects the process environment/argv, as it does in a real CLI run.
  vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
  const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
    throw new Error('exit')
  })
  onTestFinished(() => exitSpy.mockRestore())
  vi.mocked(currentProcessIsGlobal).mockReturnValue(true)
  vi.mocked(inferPackageManagerForGlobalCLI).mockReturnValue('npm')
  vi.mocked(checkForCachedNewVersion).mockReturnValue(CLI_KIT_VERSION)
  vi.mocked(globalCLIVersion).mockResolvedValue(undefined)
  if (failure === 'install') {
    vi.mocked(exec).mockRejectedValue(new ExternalError('install failed', 'npm', ['install']))
  }

  await expect(Upgrade.run(['--json'], import.meta.url)).rejects.toThrow()

  const result = JSON.parse(streams.stdout())
  expect(exitSpy).toHaveBeenCalledWith(1)
  expect(result.error.type).toBe(failure === 'install' ? 'external' : 'abort')
  expect(result).not.toHaveProperty('status')
  expect(streams.stdout()).toContain(failure === 'install' ? 'install failed' : "Couldn't verify")
})
