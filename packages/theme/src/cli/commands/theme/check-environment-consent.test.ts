import Check from './check.js'
import {afterEach, expect, test, vi} from 'vitest'
import {Config} from '@oclif/core'
import {themeCheckRun} from '@shopify/theme-check-node'
import * as environments from '@shopify/cli-kit/node/environments'
import {inTemporaryDirectory, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'

vi.mock('@shopify/theme-check-node', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/theme-check-node')>()),
  themeCheckRun: vi.fn(),
}))

vi.mock('@shopify/cli-kit/node/environments', async (importOriginal) => {
  const actual = await importOriginal<typeof environments>()
  return {...actual, loadEnvironment: vi.fn(actual.loadEnvironment)}
})

afterEach(() => vi.unstubAllEnvs())

test.each(
  ['default', 'named', 'multiple'].flatMap((source) => [
    {source, configuredConsent: 'true', argv: [], processConsent: undefined, allowed: undefined},
    {source, configuredConsent: 'false', argv: [], processConsent: undefined, allowed: undefined},
    {source, configuredConsent: '"invalid"', argv: [], processConsent: undefined, allowed: undefined},
    {source, configuredConsent: 'false', argv: ['--allow-custom-checks'], processConsent: undefined, allowed: true},
    {source, configuredConsent: 'false', argv: [], processConsent: '1', allowed: true},
    {source, configuredConsent: 'true', argv: ['--no-allow-custom-checks'], processConsent: '1', allowed: false},
  ]),
)(
  'ignores TOML consent before parsing and reporting: $source / $configuredConsent / $argv / $processConsent',
  async ({source, configuredConsent, argv, processConsent, allowed}) => {
    vi.stubEnv('SHOPIFY_FLAG_ALLOW_CUSTOM_CHECKS', processConsent)
    vi.stubEnv('SHOPIFY_FLAG_ENVIRONMENT', undefined)
    vi.mocked(themeCheckRun).mockResolvedValue({offenses: [], theme: [], config: {} as never})
    await inTemporaryDirectory(async (directory) => {
      const names = source === 'multiple' ? ['first', 'second'] : [source]
      await writeFile(
        joinPath(directory, 'shopify.theme.toml'),
        names
          .map(
            (name) =>
              `[environments.${name}]\npath = ${JSON.stringify(directory)}\nallow-custom-checks = ${configuredConsent}\n`,
          )
          .join('\n'),
      )
      const actual = await vi.importActual<typeof environments>('@shopify/cli-kit/node/environments')
      vi.mocked(environments.loadEnvironment).mockImplementation((name, filename, options) =>
        actual.loadEnvironment(name, filename, {...options, from: directory}),
      )
      const config = new Config({root: __dirname})
      await config.load()
      const check = new Check(
        [
          ...(source === 'default' ? [`--path=${directory}`] : names.flatMap((name) => ['--environment', name])),
          '--json',
          '--no-input',
          ...argv,
        ],
        config,
      )
      const runCommand = vi.spyOn(check, 'command')
      await withCapturedStandardStreams(async ({stdout, stderr}) => {
        await check.run()
        const result = JSON.parse(stdout())
        if (source === 'default') {
          expect(result.valid).toBe(true)
        } else {
          expect(result.environments.map((entry: {result: {valid: boolean}}) => entry.result.valid)).toEqual(
            names.map(() => true),
          )
        }
        expect(stderr()).toBe('')
      })
      expect(runCommand).toHaveBeenCalledTimes(names.length)
      for (const [flags] of runCommand.mock.calls) {
        expect(flags.path).toBe(directory)
        if (allowed === undefined) {
          expect(flags).not.toHaveProperty('allow-custom-checks')
        } else {
          expect(flags['allow-custom-checks']).toBe(allowed)
        }
      }
      expect(themeCheckRun).toHaveBeenCalledTimes(names.length)
      await Promise.all(
        vi
          .mocked(themeCheckRun)
          .mock.calls.map(([, , , options]) =>
            expect(Promise.resolve(options?.authorizeCustomChecks?.({root: directory, candidates: []}))).resolves.toBe(
              allowed === true,
            ),
          ),
      )
    })
  },
)

test('reports ordinary applicable TOML flags without reporting consent', async () => {
  vi.stubEnv('SHOPIFY_FLAG_ALLOW_CUSTOM_CHECKS', undefined)
  vi.mocked(themeCheckRun).mockResolvedValue({offenses: [], theme: [], config: {} as never})
  await inTemporaryDirectory(async (directory) => {
    await writeFile(
      joinPath(directory, 'shopify.theme.toml'),
      '[environments.default]\nallow-custom-checks = true\nfail-level = "warning"\n',
    )
    const config = new Config({root: __dirname})
    await config.load()
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await new Check([`--path=${directory}`, '--json', '--no-input'], config).run()
      expect(JSON.parse(stdout()).valid).toBe(true)
      expect(JSON.parse(stderr()).message).toBe('Using applicable flags from default environment:\nfail-level: warning')
    })
  })
})
