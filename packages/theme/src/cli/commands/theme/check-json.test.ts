import Check from './check.js'
import {checkTheme, formatOffensesJson, sortOffenses} from '../../services/check.js'
import {themeCheckJsonOutputSchema} from '../../services/check/types.js'
import {encodeThemeCheckResult} from '../../services/check/result.js'
import {expect, test, vi} from 'vitest'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {themeCheckRun, Severity, SourceCodeType, path as pathUtils} from '@shopify/theme-check-node'
import {inTemporaryDirectory, writeFile} from '@shopify/cli-kit/node/fs'
import {runWithCommandEventsForCommand} from '@shopify/cli-kit/node/command-events'
// Native JSON paths must preserve Windows separators instead of pathe normalization.
// eslint-disable-next-line no-restricted-imports
import {resolve as resolvePath} from 'node:path'

vi.mock('@shopify/theme-check-node', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/theme-check-node')>()),
  themeCheckRun: vi.fn(),
}))
vi.mock('@shopify/cli-kit/node/environments')

const offense = {
  type: SourceCodeType.LiquidHtml,
  check: 'ExampleCheck',
  severity: Severity.ERROR,
  uri: 'file:///theme/templates/index.liquid',
  start: {index: 0, line: 0, character: 0},
  end: {index: 1, line: 0, character: 1},
  message: 'Example offense',
}
const emptyResult = {valid: true, issues: [], errorCount: 0, warningCount: 0, infoCount: 0}
const invalidResult = {
  valid: false,
  issues: [
    {
      filePath: resolvePath(pathUtils.fsPath(offense.uri)),
      check: 'ExampleCheck',
      severity: 'error',
      startRow: 0,
      startColumn: 0,
      endRow: 0,
      endColumn: 1,
      message: 'Example offense',
    },
  ],
  errorCount: 1,
  warningCount: 0,
  infoCount: 0,
}

async function configuration() {
  const {Config} = await import('@oclif/core')
  const config = new Config({root: __dirname})
  await config.load()
  return config
}

test('projects the service model to flat issues with strict zero-based positions and counts', async () => {
  expect(Check.jsonOutputSchema).toBe(themeCheckJsonOutputSchema)
  vi.mocked(themeCheckRun).mockResolvedValue({offenses: [offense], theme: [], config: {} as never})
  const {result} = await checkTheme('/theme')
  expect(result).toEqual(formatOffensesJson(sortOffenses([offense])))
  expect(JSON.parse(encodeThemeCheckResult(result))).toEqual(invalidResult)
  expect(JSON.parse(encodeThemeCheckResult([]))).toEqual(emptyResult)
  expect(() => themeCheckJsonOutputSchema.validate({...invalidResult, errorCount: '1'})).toThrow()
  expect(() => themeCheckJsonOutputSchema.validate({...invalidResult, extra: true})).toThrow()
  expect(() =>
    themeCheckJsonOutputSchema.validate({...invalidResult, issues: [{...invalidResult.issues[0], startRow: -1}]}),
  ).toThrow()
  expect(() =>
    themeCheckJsonOutputSchema.validate({
      ...invalidResult,
      issues: [{...invalidResult.issues[0], filePath: 'index.liquid'}],
    }),
  ).toThrow()
})

test.each(['--json', '--output=json'])('writes one validation result and exits nonzero for %s', async (flag) => {
  await inTemporaryDirectory(async (directory) => {
    const config = await configuration()
    vi.mocked(themeCheckRun).mockResolvedValue({offenses: [offense], theme: [], config: {} as never})
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
    const previousExitCode = process.exitCode
    try {
      await withCapturedStandardStreams(async ({stdout, stderr}) => {
        await new Check([`--path=${directory}`, flag], config).run()
        expect(JSON.parse(stdout())).toEqual(invalidResult)
        expect(stderr()).toBe('')
      })
      expect(process.exitCode).toBe(1)
      expect(exit).not.toHaveBeenCalled()
    } finally {
      process.exitCode = previousExitCode
    }
  })
})

test.each(['init', 'version', 'print', 'list'])('rejects --json with --%s before execution', async (mode) => {
  await expect(new Check(['--json', `--${mode}`], await configuration()).run()).rejects.toThrow()
  expect(themeCheckRun).not.toHaveBeenCalled()
})

test.each(['success', 'single environment', 'partial failure', 'total failure', 'blocking validation'])(
  'returns every requested environment in one document on %s',
  async (mode) => {
    await inTemporaryDirectory(async (directory) => {
      const config = await configuration()
      vi.mocked(themeCheckRun).mockResolvedValue({offenses: [], theme: [], config: {} as never})
      if (mode === 'partial failure') vi.mocked(themeCheckRun).mockRejectedValueOnce(new Error('Check failed'))
      if (mode === 'total failure') {
        vi.mocked(themeCheckRun).mockImplementation(async () => {
          throw new Error('Check failed')
        })
      }
      if (mode === 'blocking validation')
        vi.mocked(themeCheckRun).mockResolvedValueOnce({offenses: [offense], theme: [], config: {} as never})
      const {loadEnvironment} = await import('@shopify/cli-kit/node/environments')
      vi.mocked(loadEnvironment).mockResolvedValue({path: directory})
      const previousExitCode = process.exitCode
      process.exitCode = 0
      try {
        await withCapturedStandardStreams(async ({stdout, stderr}) => {
          const argv = [
            '--environment=first',
            ...(mode === 'single environment' ? [] : ['--environment=second']),
            '--json',
          ]
          await runWithCommandEventsForCommand(argv, () => new Check(argv, config).run())
          const first = mode.includes('failure')
            ? {environment: 'first', error: expect.objectContaining({message: 'Check failed'})}
            : {environment: 'first', result: mode === 'blocking validation' ? invalidResult : emptyResult}
          const second =
            mode === 'total failure'
              ? {environment: 'second', error: expect.objectContaining({message: 'Check failed'})}
              : {environment: 'second', result: emptyResult}
          expect(JSON.parse(stdout())).toEqual({
            environments: mode === 'single environment' ? [first] : [first, second],
          })
          expect(process.exitCode).toBe(mode.includes('failure') || mode === 'blocking validation' ? 1 : 0)
          if (mode.includes('failure')) expect(stderr()).toContain('Check failed')
        })
      } finally {
        // Each test restores the process state after its asynchronous command has completed.
        // eslint-disable-next-line require-atomic-updates
        process.exitCode = previousExitCode
      }
    })
  },
)

test.each(
  ['json = true', 'output = "json"'].flatMap((setting) =>
    [false, true].flatMap((mixed) =>
      ['success', 'validation failure', 'execution failure'].map((outcome) => ({setting, mixed, outcome})),
    ),
  ),
)(
  'collects JSON selected in environment configuration: $setting, mixed=$mixed, outcome=$outcome',
  async ({setting, mixed, outcome}) => {
    await inTemporaryDirectory(async (directory) => {
      await writeFile(
        resolvePath(directory, 'shopify.theme.toml'),
        [
          '[environments.first]',
          outcome === 'validation failure' ? '' : `path = ${JSON.stringify(directory)}`,
          mixed ? '' : setting,
          '[environments.second]',
          `path = ${JSON.stringify(directory)}`,
          setting,
        ].join('\n'),
      )
      const {loadEnvironment} = await import('@shopify/cli-kit/node/environments')
      const actual = await vi.importActual<typeof import('@shopify/cli-kit/node/environments')>(
        '@shopify/cli-kit/node/environments',
      )
      vi.mocked(loadEnvironment).mockImplementation((environment, filename, options) =>
        actual.loadEnvironment(environment, filename, {...options, from: directory}),
      )
      vi.mocked(themeCheckRun).mockResolvedValue({offenses: [], theme: [], config: {} as never})
      if (outcome === 'execution failure') vi.mocked(themeCheckRun).mockRejectedValueOnce(new Error('Check failed'))
      const config = await configuration()
      const previousExitCode = process.exitCode
      process.exitCode = 0
      try {
        await withCapturedStandardStreams(async ({stdout, stderr}) => {
          const argv = ['-e', 'first', '-e', 'second']
          await runWithCommandEventsForCommand(argv, () => new Check(argv, config).run())

          expect(JSON.parse(stdout())).toEqual({
            environments: [
              outcome === 'success'
                ? {environment: 'first', result: emptyResult}
                : {
                    environment: 'first',
                    error: expect.objectContaining({
                      message: outcome === 'validation failure' ? 'Missing flags: path' : 'Check failed',
                    }),
                  },
              {environment: 'second', result: emptyResult},
            ],
          })
          if (outcome === 'success') {
            expect(stderr()).toBe('')
          } else {
            expect(JSON.parse(stderr())).toMatchObject({
              type: 'diagnostic',
              level: outcome === 'validation failure' ? 'warning' : 'error',
              code: outcome === 'validation failure' ? 'theme-environment-invalid' : 'theme-environment-failed',
              message: expect.stringContaining('first'),
            })
          }
        })
        expect(process.exitCode).toBe(outcome === 'success' ? 0 : 1)
        expect(themeCheckRun).toHaveBeenCalledTimes(outcome === 'validation failure' ? 1 : 2)
      } finally {
        process.exitCode = previousExitCode
      }
    })
  },
)

test.each(
  ['json = true', 'output = "json"'].flatMap((setting) => [false, true].map((failure) => ({setting, failure}))),
)(
  'uses JSON diagnostics for a single configured environment: $setting, failure=$failure',
  async ({setting, failure}) => {
    await inTemporaryDirectory(async (directory) => {
      await writeFile(
        resolvePath(directory, 'shopify.theme.toml'),
        `[environments.first]\npath = ${JSON.stringify(directory)}\n${setting}\n`,
      )
      const {loadEnvironment} = await import('@shopify/cli-kit/node/environments')
      const actual = await vi.importActual<typeof import('@shopify/cli-kit/node/environments')>(
        '@shopify/cli-kit/node/environments',
      )
      vi.mocked(loadEnvironment).mockImplementation((environment, filename, options) =>
        actual.loadEnvironment(environment, filename, {...options, from: directory}),
      )
      vi.mocked(themeCheckRun).mockResolvedValue({offenses: [], theme: [], config: {} as never})
      if (failure) vi.mocked(themeCheckRun).mockRejectedValueOnce(new Error('Check failed'))
      const config = await configuration()
      const previousExitCode = process.exitCode
      process.exitCode = 0
      try {
        await withCapturedStandardStreams(async ({stdout, stderr}) => {
          const argv = ['-e', 'first']
          await runWithCommandEventsForCommand(argv, () => new Check(argv, config).run())

          expect(JSON.parse(stdout())).toEqual({
            environments: [
              failure
                ? {environment: 'first', error: {type: 'abort', message: 'Check failed'}}
                : {environment: 'first', result: emptyResult},
            ],
          })
          await vi.waitFor(() => expect(stderr()).not.toBe(''))
          const events = stderr()
            .trim()
            .split('\n')
            .map((line) => JSON.parse(line))
          expect(events).toContainEqual(
            expect.objectContaining({
              type: 'diagnostic',
              level: 'info',
              message: expect.stringContaining('Using applicable flags from first environment:'),
            }),
          )
          if (failure) {
            expect(events).toContainEqual(
              expect.objectContaining({type: 'diagnostic', level: 'error', code: 'theme-environment-failed'}),
            )
          }
        })
        expect(process.exitCode).toBe(failure ? 1 : 0)
      } finally {
        process.exitCode = previousExitCode
      }
    })
  },
)

class LifecycleCheck extends Check {
  execute(): Promise<void> {
    return this._run<void>()
  }
}

test.each(
  [
    {setting: 'json = true', invalidFlag: 'fail-level = "bogus"', message: '--fail-level', textOverride: false},
    {setting: 'output = "json"', invalidFlag: 'fail-level = "bogus"', message: '--fail-level', textOverride: false},
    {setting: 'json = true', invalidFlag: 'init = true', message: '--init', textOverride: false},
    {setting: 'output = "json"', invalidFlag: 'fail-level = "bogus"', message: '--fail-level', textOverride: true},
  ].flatMap((flags) => ['first', 'default'].map((environment) => ({...flags, environment}))),
)(
  'uses the requested format for environment parsing errors: $environment, $setting, $invalidFlag, textOverride=$textOverride',
  async ({setting, invalidFlag, message, environment, textOverride}) => {
    await inTemporaryDirectory(async (directory) => {
      await writeFile(
        resolvePath(directory, 'shopify.theme.toml'),
        `[environments.${environment}]\n${setting}\n${invalidFlag}\n`,
      )
      const environments = await import('@shopify/cli-kit/node/environments')
      const actual = await vi.importActual<typeof environments>('@shopify/cli-kit/node/environments')
      vi.mocked(environments.loadEnvironment).mockImplementation(actual.loadEnvironment)
      vi.mocked(environments.environmentFilePath).mockImplementation(actual.environmentFilePath)
      vi.spyOn(Check.prototype as unknown as {init(): Promise<unknown>}, 'init').mockResolvedValue(undefined)
      vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
      const config = await configuration()
      const argv = [
        '--path',
        directory,
        ...(environment === 'default' ? [] : ['--environment', environment]),
        ...(textOverride ? ['--output=text'] : []),
      ]

      await withCapturedStandardStreams(async ({stdout, stderr}) => {
        await runWithCommandEventsForCommand(argv, () => new LifecycleCheck(argv, config).execute())

        if (textOverride) {
          expect(stdout()).toBe('')
          expect(stderr()).toContain(message)
        } else {
          expect(JSON.parse(stdout())).toEqual({
            error: expect.objectContaining({type: 'abort', message: expect.stringContaining(message)}),
          })
          expect(stderr()).toBe('')
        }
      })
      expect(process.exit).toHaveBeenCalledWith(2)
      expect(themeCheckRun).not.toHaveBeenCalled()
    })
  },
)

test.each([['--output=json'], ['-o', 'json']])(
  'uses the standard JSON error envelope with an outer text context for %j',
  async (...flags) => {
    const config = await configuration()
    vi.spyOn(Check.prototype as unknown as {init(): Promise<unknown>}, 'init').mockResolvedValue(undefined)
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
    await withCapturedStandardStreams(async ({stdout}) => {
      const argv = [...flags, '--version']
      await runWithCommandEventsForCommand(argv, () => new LifecycleCheck(argv, config).execute())
      expect(JSON.parse(stdout())).toEqual({
        error: expect.objectContaining({type: 'abort', message: expect.any(String)}),
      })
    })
    expect(process.exit).toHaveBeenCalledWith(2)
    expect(themeCheckRun).not.toHaveBeenCalled()
  },
)

test('does not write a validation result before a requested correction fails', async () => {
  const checkService = await import('../../services/check.js')
  vi.spyOn(checkService, 'performAutoFixes').mockRejectedValue(new Error('Unable to write corrected file'))
  vi.mocked(themeCheckRun).mockResolvedValue({offenses: [offense], theme: [], config: {} as never})
  await inTemporaryDirectory(async (directory) => {
    const config = await configuration()
    await withCapturedStandardStreams(async ({stdout}) => {
      await expect(new Check([`--path=${directory}`, '--json', '--auto-correct'], config).run()).rejects.toThrow(
        'Unable to write corrected file',
      )
      expect(stdout()).toBe('')
    })
  })
})
