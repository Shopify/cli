import {withCapturedStandardStreams, mockAndCaptureOutput} from './output.js'
import {launchCLI} from '../cli-launcher.js'
import {ShopifyConfig} from '../custom-oclif-loader.js'
import {unstyled} from '../output.js'
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest'
import type BaseCommand from '../base-command.js'
import type {JsonOutputSchema} from '../json-output-schema.js'

interface JsonCommandTestOptions {
  command: typeof BaseCommand & {readonly jsonOutputSchema: JsonOutputSchema}
  commandId: string
  moduleURL: string
  args: string[]
  expectedResult: Record<string, unknown>
  expectedEvents?: Record<string, unknown>[]
  expectedSchema: Record<string, unknown>
  setup: () => void | Promise<void>
  assertExecuted: () => void
  assertNotExecuted: () => void
  textOutput: {stdout: string; stderr: string}
  diagnostics?: {
    setup: () => void | Promise<void>
    expectedEvents: Record<string, unknown>[]
  }
  failure?: {
    setup: () => void | Promise<void>
    expectedError: Record<string, unknown>
    expectedEvents?: Record<string, unknown>[]
    exitCode: number
  }
}

/**
 * Registers shared JSON contract tests for a finite command using its real launcher and output writers.
 * Supply independent expected results and callbacks that check the command's service calls.
 * Keep domain-specific input, schema, prompt, and file tests beside the command.
 * This suite captures process globals and must not run concurrently with other tests.
 *
 * @param options - The command, fixtures, expected output, and service assertions.
 */
export function describeJsonCommand(options: JsonCommandTestOptions): void {
  const {command, commandId, moduleURL, args, expectedResult} = options

  describe.sequential(`${commandId} JSON contract`, () => {
    let originalExitCode: typeof process.exitCode
    let restoreMocks: () => void

    beforeEach(async () => {
      originalExitCode = process.exitCode
      process.exitCode = undefined
      vi.stubEnv('CI', '1')
      vi.stubEnv('SHOPIFY_CLI_NO_ANALYTICS', '1')
      vi.stubEnv('SHOPIFY_FLAG_JSON', '0')
      vi.stubEnv('SHOPIFY_FLAG_JSON_SCHEMA', '0')
      vi.stubEnv('SHOPIFY_FLAG_NO_INPUT', '0')
      const hooks = vi.spyOn(ShopifyConfig.prototype, 'runHook').mockResolvedValue({successes: [], failures: []})
      const exit = vi.spyOn(process, 'exit').mockReturnValue(undefined as never)
      restoreMocks = () => {
        hooks.mockRestore()
        exit.mockRestore()
      }
      await options.setup()
    })

    afterEach(() => {
      restoreMocks()
      process.exitCode = originalExitCode
      vi.unstubAllEnvs()
      mockAndCaptureOutput().clear()
    })

    const run = async (flags: string[], commandArgs = args) => {
      const argv = [...commandId.split(':'), ...commandArgs, ...flags]
      const originalArgv = process.argv
      const restoreArgv = () => {
        process.argv = originalArgv
      }
      // Error handling and some output helpers read process.argv instead of the launcher's argv option.
      process.argv = [...originalArgv.slice(0, 2), ...argv]
      try {
        await launchCLI({moduleURL, argv, lazyCommandLoader: async () => command})
      } finally {
        restoreArgv()
      }
    }

    const expectResult = (stdout: string) => {
      expect(stdout).toBe(`${JSON.stringify(expectedResult, null, 2)}\n`)
      command.jsonOutputSchema.validate(JSON.parse(stdout))
      options.assertExecuted()
      expect(process.exit).not.toHaveBeenCalled()
      expect(process.exitCode ?? 0).toBe(0)
    }

    const expectEvents = (stderr: string, expectedEvents = options.expectedEvents ?? []) => {
      const events = stderr.trim()
        ? stderr
            .trim()
            .split('\n')
            .map((line) => JSON.parse(line))
        : []
      expect(events).toMatchObject(expectedEvents)
    }

    test.each(['--json', '-j'])('writes one result with %s', async (flag) => {
      await withCapturedStandardStreams(async ({stdout, stderr}) => {
        await run([flag])
        expectResult(stdout())
        expectEvents(stderr())
      })
    })

    test('supports the JSON environment flag', async () => {
      vi.stubEnv('SHOPIFY_FLAG_JSON', '1')
      await withCapturedStandardStreams(async ({stdout, stderr}) => {
        await run([])
        expectResult(stdout())
        expectEvents(stderr())
      })
    })

    test.each([false, true])('keeps no-input independent from JSON: %s', async (json) => {
      await withCapturedStandardStreams(async ({stdout, stderr}) => {
        await run(['--no-input', ...(json ? ['--json'] : [])])
        if (json) {
          expectResult(stdout())
          expectEvents(stderr())
        } else {
          expect(stdout()).toBe(options.textOutput.stdout)
          expect(unstyled(stderr())).toBe(options.textOutput.stderr)
          options.assertExecuted()
          expect(process.exit).not.toHaveBeenCalled()
          expect(process.exitCode ?? 0).toBe(0)
        }
      })
    })

    test('exposes the result schema in help', () => {
      expect(command.description).toContain(
        `Output from \`--json\` conforms to the \`${command.jsonOutputSchema.name}\` schema.`,
      )
    })

    test('discovers the schema without required inputs, hooks, or service calls', async () => {
      await withCapturedStandardStreams(async ({stdout, stderr}) => {
        await run(['--json-schema'], [])
        expect(JSON.parse(stdout()).definitions.Result).toMatchObject(options.expectedSchema)
        expect(stderr()).toBe('')
        expect(ShopifyConfig.prototype.runHook).not.toHaveBeenCalled()
        options.assertNotExecuted()
        expect(process.exit).not.toHaveBeenCalled()
      })
    })

    const diagnostics = options.diagnostics
    if (diagnostics) {
      test('writes diagnostics to stderr separately from the result', async () => {
        await diagnostics.setup()
        await withCapturedStandardStreams(async ({stdout, stderr}) => {
          await run(['--json'])
          expectResult(stdout())
          expectEvents(stderr(), diagnostics.expectedEvents)
        })
      })
    }

    const failure = options.failure
    if (failure) {
      test('writes only the fatal error and preserves the failure exit code', async () => {
        await failure.setup()
        await withCapturedStandardStreams(async ({stdout, stderr}) => {
          await run(['--json'])
          expect(JSON.parse(stdout())).toEqual(failure.expectedError)
          expectEvents(stderr(), failure.expectedEvents ?? [])
          options.assertExecuted()
          expect(process.exit).toHaveBeenCalledExactlyOnceWith(failure.exitCode)
        })
      })
    }
  })
}
