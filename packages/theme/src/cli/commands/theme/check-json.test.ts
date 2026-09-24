import Check from './check.js'
import {checkTheme, formatOffensesJson, sortOffenses} from '../../services/check.js'
import {themeCheckJsonOutputSchema} from '../../services/check/types.js'
import {encodeThemeCheckResult} from '../../services/check/result.js'
import {expect, test, vi} from 'vitest'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {themeCheckRun, Severity, SourceCodeType, path as pathUtils} from '@shopify/theme-check-node'
import {inTemporaryDirectory} from '@shopify/cli-kit/node/fs'

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

test('exposes the contract and preserves compact JSON, environment omission and counts', async () => {
  expect(Check.jsonOutputSchema).toBe(themeCheckJsonOutputSchema)
  vi.mocked(themeCheckRun).mockResolvedValue({offenses: [offense], theme: [], config: {} as never})
  const {result} = await checkTheme('/theme')
  expect(result).toEqual(formatOffensesJson(sortOffenses([offense])))
  expect(encodeThemeCheckResult(result)).toBe(
    JSON.stringify([
      {
        path: pathUtils.fsPath(offense.uri),
        offenses: [
          {
            check: 'ExampleCheck',
            severity: 'error',
            start_row: 0,
            start_column: 0,
            end_row: 0,
            end_column: 1,
            message: 'Example offense',
          },
        ],
        errorCount: 1,
        warningCount: 0,
        infoCount: 0,
      },
    ]),
  )
  expect(encodeThemeCheckResult([])).toBe('[]')
  expect(() => themeCheckJsonOutputSchema.validate([{...result[0], errorCount: '1'}])).toThrow()
  expect(() =>
    themeCheckJsonOutputSchema.validate([{...result[0], offenses: [{...result[0]!.offenses[0], severity: 'fatal'}]}]),
  ).toThrow()
})

test.each(['--json', '--output=json'])('writes compact JSON and preserves unsuccessful exit with %s', async (flag) => {
  await inTemporaryDirectory(async (directory) => {
    const {default: StreamCheck} = await import('./check.js')
    const {themeCheckRun: check} = await import('@shopify/theme-check-node')
    const {Config} = await import('@oclif/core')
    const config = new Config({root: __dirname})
    await config.load()
    vi.mocked(check).mockResolvedValue({offenses: [offense], theme: [], config: {} as never})
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await new StreamCheck([`--path=${directory}`, flag], config).run()
      expect(stdout()).toBe(`${JSON.stringify(formatOffensesJson(sortOffenses([offense])))}\n`)
      expect(stderr()).toBe('')
    })
    expect(exit).toHaveBeenCalledWith(1)
  })
})

test.each(['init', 'version', 'print', 'list'])('rejects --json with --%s before execution', async (mode) => {
  const {Config} = await import('@oclif/core')
  const config = new Config({root: __dirname})
  await config.load()
  await expect(new Check(['--json', `--${mode}`], config).run()).rejects.toThrow()
  expect(themeCheckRun).not.toHaveBeenCalled()
})

test.each(['success', 'partial failure', 'total failure'])(
  'collects multiple environments into one document on %s',
  async (mode) => {
    await inTemporaryDirectory(async (directory) => {
      const {default: StreamCheck} = await import('./check.js')
      const {themeCheckRun: check} = await import('@shopify/theme-check-node')
      const {Config} = await import('@oclif/core')
      const config = new Config({root: __dirname})
      await config.load()
      vi.mocked(check).mockResolvedValue({offenses: [], theme: [], config: {} as never})
      if (mode === 'partial failure') vi.mocked(check).mockRejectedValueOnce(new Error('Check failed'))
      if (mode === 'total failure') vi.mocked(check).mockRejectedValue(new Error('Check failed'))
      const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
      const {loadEnvironment} = await import('@shopify/cli-kit/node/environments')
      vi.mocked(loadEnvironment).mockResolvedValue({path: directory})
      const {runWithCommandEventsForCommand} = await import('@shopify/cli-kit/node/command-events')
      await withCapturedStandardStreams(async ({stdout, stderr}) => {
        const argv = ['--environment=first', '--environment=second', '--json']
        await runWithCommandEventsForCommand(argv, () => new StreamCheck(argv, config).run())
        let names = ['first', 'second']
        if (mode === 'partial failure') names = ['second']
        if (mode === 'total failure') names = []
        expect(JSON.parse(stdout())).toEqual({
          environments: names.map((environment) => ({environment, result: []})),
        })
        if (mode.includes('failure')) expect(stderr()).toContain('Check failed')
      })
      expect(exit).not.toHaveBeenCalled()
    })
  },
)
