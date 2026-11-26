import Check from './check.js'
import {Config} from '@oclif/core'
import {JSONValidator} from '@shopify/theme-check-node'
import {inTemporaryDirectory, writeFile, fileExists, mkdir} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import * as cliPath from '@shopify/cli-kit/node/path'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {afterEach, expect, test, vi} from 'vitest'

afterEach(() => {
  vi.unstubAllEnvs()
})

test.each([
  {flags: [], allowed: false},
  {flags: ['--allow-custom-checks'], allowed: true},
  {flags: ['--print'], allowed: false},
  {flags: ['--print', '--allow-custom-checks'], allowed: true},
  {flags: ['--list'], allowed: false},
  {flags: ['--list', '--allow-custom-checks'], allowed: true},
  {flags: ['--auto-correct'], allowed: false},
  {flags: ['--allow-custom-checks'], environmentValue: '0', allowed: true},
  {flags: ['--no-allow-custom-checks'], environmentValue: '1', allowed: false},
  {flags: [], environmentValue: '1', allowed: true},
  {flags: ['--environment=first', '--environment=second'], allowed: false},
])('guards custom JavaScript in theme check with $flags', async ({flags, allowed, environmentValue}) => {
  vi.stubEnv('SHOPIFY_FLAG_ALLOW_CUSTOM_CHECKS', environmentValue)
  vi.spyOn(JSONValidator, 'create').mockResolvedValue(undefined)
  const previousExitCode = process.exitCode
  try {
    await inTemporaryDirectory(async (directory) => {
      vi.spyOn(cliPath, 'cwd').mockReturnValue(directory)
      const warning = vi.spyOn(console, 'error').mockImplementation(() => {})
      const marker = joinPath(directory, 'executed')
      await writeFile(joinPath(directory, '.theme-check.yml'), "require: './checks.cjs'\n")
      await writeFile(
        joinPath(directory, 'checks.cjs'),
        `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'yes'); exports.checks = []`,
      )
      // A theme-controlled default or named environment must never grant code execution.
      await writeFile(
        joinPath(directory, 'shopify.theme.toml'),
        `[environments.default]\nallow-custom-checks = true\n[environments.first]\nallow-custom-checks = true\npath = ${JSON.stringify(directory)}\n[environments.second]\nallow-custom-checks = true\npath = ${JSON.stringify(directory)}\n`,
      )
      await mkdir(joinPath(directory, 'snippets'))
      await writeFile(joinPath(directory, 'snippets', 'example.liquid'), 'Hello')
      const config = await Config.load()
      const mode = flags.includes('--print') || flags.includes('--list') ? [] : ['--json']
      await withCapturedStandardStreams(async ({stdout, stderr}) => {
        const pathFlags = flags.some((flag) => flag.startsWith('--environment')) ? [] : [`--path=${directory}`]
        await new Check([...pathFlags, ...flags, ...mode], config).run()
        await expect(fileExists(marker)).resolves.toBe(allowed)
        if (!allowed) {
          if (mode.length) expect(stderr()).toContain('Custom Theme Checks are disabled')
          else expect(warning).toHaveBeenCalledWith(expect.stringContaining('Custom Theme Checks are disabled'))
        }
        if (mode.length && !flags.some((flag) => flag.startsWith('--environment'))) {
          expect(JSON.parse(stdout())).toMatchObject({valid: true, issues: expect.any(Array)})
        }
      })
    })
  } finally {
    // Each invocation completes before the test restores the process exit status.
    // eslint-disable-next-line require-atomic-updates
    process.exitCode = previousExitCode
  }
})

test.each([
  {customChecks: true, allowed: false},
  {customChecks: true, allowed: true},
  {customChecks: false, allowed: false},
])('includes a summary notice only for skipped custom checks: %j', async ({customChecks, allowed}) => {
  vi.stubEnv('SHOPIFY_FLAG_ALLOW_CUSTOM_CHECKS', undefined)
  vi.spyOn(JSONValidator, 'create').mockResolvedValue(undefined)
  vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
  const warning = vi.spyOn(console, 'error').mockImplementation(() => {})
  await inTemporaryDirectory(async (directory) => {
    vi.spyOn(cliPath, 'cwd').mockReturnValue(directory)
    const requirements = customChecks ? "require: './checks.cjs'\nConsentProbe:\n  enabled: true\n" : ''
    await writeFile(joinPath(directory, '.theme-check.yml'), `extends: theme-check:recommended\n${requirements}`)
    await writeFile(
      joinPath(directory, 'checks.cjs'),
      `exports.checks = [{
        meta: {
          code: 'ConsentProbe', name: 'Consent probe', docs: {description: 'Confirms execution'},
          type: 'LiquidHtml', severity: 1, schema: {},
        },
        create(context) {
          return {async onCodePathEnd() {
            context.report({startIndex: 0, endIndex: 5, message: 'Custom check executed'});
          }};
        },
      }];`,
    )
    await mkdir(joinPath(directory, 'layout'))
    await mkdir(joinPath(directory, 'locales'))
    await writeFile(joinPath(directory, 'locales', 'en.default.json'), '{}')
    await writeFile(
      joinPath(directory, 'layout', 'theme.liquid'),
      '<!doctype html>\n<html lang="en"><head>{{ content_for_header }}</head><body>{{ content_for_layout }}</body></html>',
    )
    const config = await Config.load()
    const args = [`--path=${directory}`]
    if (allowed) args.push('--allow-custom-checks')
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await new Check(args, config).run()
      const output = stdout() + stderr()
      const notice = 'Custom theme checks are disabled.'
      expect(output.match(/Theme Check Summary\./g)).toHaveLength(1)
      if (customChecks && !allowed) {
        expect(output.split(notice)).toHaveLength(2)
        expect(output.indexOf(notice)).toBeGreaterThan(output.indexOf('Theme Check Summary.'))
        expect(output).toContain('--allow-custom-checks')
        expect(output.match(/with no offenses found\./g)).toHaveLength(1)
      } else {
        expect(output).not.toContain(notice)
        if (customChecks) {
          expect(output).toContain('ConsentProbe')
          expect(output).toContain('1 warnings.')
        }
      }
      expect(output).not.toContain('Explicit authorization is required')
      expect(warning).not.toHaveBeenCalledWith(expect.stringContaining('Custom Theme Checks are disabled'))
    })
  })
})
