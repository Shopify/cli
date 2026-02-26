import {fileExists, readFile} from '../fs.js'
import {isAbsolutePath, joinPath, relativePath} from '../path.js'
import {execCommand, captureCommandWithExitCode} from '../system.js'
import type {DoctorContext, TestResult, AssertionResult} from './types.js'

/**
 * Result from running a CLI command.
 */
interface CommandResult {
  /** The full command that was run. */
  command: string
  /** Exit code (0 = success). */
  exitCode: number
  /** Standard output. */
  stdout: string
  /** Standard error. */
  stderr: string
  /** Combined output (stdout + stderr). */
  output: string
  /** Whether the command succeeded (exitCode === 0). */
  success: boolean
}

/**
 * A registered test with its name and function.
 */
interface RegisteredTest {
  /** The test name. */
  name: string
  /** The async test function. */
  fn: () => Promise<void>
}

/**
 * Base class for doctor test suites.
 *
 * Write tests using the test() method.
 *
 * ```typescript
 * export default class MyTests extends DoctorSuite {
 *   static description = 'My test suite'
 *
 *   tests() {
 *     this.test('basic case', async () => {
 *       const result = await this.run('shopify theme init')
 *       this.assertSuccess(result)
 *     })
 *
 *     this.test('error case', async () => {
 *       const result = await this.run('shopify theme init --invalid')
 *       this.assertError(result, /unknown flag/)
 *     })
 *   }
 * }
 * ```
 */
export abstract class DoctorSuite<TContext extends DoctorContext = DoctorContext> {
  static description = 'Doctor test suite'

  protected context!: TContext
  private assertions: AssertionResult[] = []
  private registeredTests: RegisteredTest[] = []

  /**
   * Run the entire test suite.
   *
   * @param context - The doctor context for this suite run.
   * @returns The list of test results.
   */
  async runSuite(context: TContext): Promise<TestResult[]> {
    this.context = context
    this.registeredTests = []
    const results: TestResult[] = []

    // Call tests() to register tests via this.test()
    this.tests()

    // Run all registered tests
    for (const registeredTest of this.registeredTests) {
      this.assertions = []
      const startTime = Date.now()

      try {
        // eslint-disable-next-line no-await-in-loop
        await registeredTest.fn()

        results.push({
          name: registeredTest.name,
          status: this.hasFailures() ? 'failed' : 'passed',
          duration: Date.now() - startTime,
          assertions: [...this.assertions],
        })
        // eslint-disable-next-line no-catch-all/no-catch-all
      } catch (error) {
        results.push({
          name: registeredTest.name,
          status: 'failed',
          duration: Date.now() - startTime,
          assertions: [...this.assertions],
          error: error instanceof Error ? error : new Error(String(error)),
        })
      }
    }

    return results
  }

  /**
   * Register a test with a name and function.
   *
   * @param name - The test name.
   * @param fn - The async test function.
   */
  protected test(name: string, fn: () => Promise<void>): void {
    this.registeredTests.push({name, fn})
  }

  /**
   * Override this method to register tests using this.test().
   */
  protected tests(): void {
    // Subclasses override this to register tests
  }

  // ============================================
  // Command execution
  // ============================================

  /* eslint-disable tsdoc/syntax -- jsdoc/require-param expects dotted names for destructured options; tsdoc disallows dots */
  /**
   * Run a CLI command and return the result.
   *
   * @param command - The CLI command to run.
   * @param options - Optional overrides.
   * @param options.cwd - Working directory for the command.
   * @param options.env - Environment variables for the command.
   * @example
   * const result = await this.run('shopify theme init my-theme')
   * const result = await this.run('shopify theme push --json')
   */
  protected async run(
    command: string,
    options?: {cwd?: string; env?: {[key: string]: string}},
  ): Promise<CommandResult> {
    const cwd = options?.cwd ?? this.context.workingDirectory
    const result = await captureCommandWithExitCode(command, {cwd, env: options?.env})

    return {
      command,
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      output: String(result.stdout) + String(result.stderr),
      success: result.exitCode === 0,
    }
  }

  /**
   * Run a command without capturing output (for interactive commands).
   * Returns only success/failure.
   *
   * @param command - The CLI command to run.
   * @param options - Optional overrides.
   * @param options.cwd - Working directory for the command.
   * @param options.env - Environment variables for the command.
   */
  protected async runInteractive(
    command: string,
    options?: {cwd?: string; env?: {[key: string]: string}},
  ): Promise<CommandResult> {
    const cwd = options?.cwd ?? this.context.workingDirectory
    let exitCode = 0

    try {
      await execCommand(command, {cwd, env: options?.env, stdin: 'inherit'})
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch {
      exitCode = 1
    }

    return {
      command,
      exitCode,
      stdout: '',
      stderr: '',
      output: '',
      success: exitCode === 0,
    }
  }
  /* eslint-enable tsdoc/syntax */

  // ============================================
  // Assertions
  // ============================================

  /**
   * Assert that a command succeeded (exit code 0).
   *
   * @param result - The command result to check.
   * @param message - Optional custom assertion message.
   */
  protected assertSuccess(result: CommandResult, message?: string): void {
    this.assertions.push({
      description: message ?? `Command succeeded: ${result.command}`,
      passed: result.success,
      expected: 'exit code 0',
      actual: `exit code ${result.exitCode}`,
    })
  }

  /**
   * Assert that a command failed with an error matching the pattern.
   *
   * @param result - The command result to check.
   * @param pattern - Optional regex or string pattern to match against output.
   * @param message - Optional custom assertion message.
   */
  protected assertError(result: CommandResult, pattern?: RegExp | string, message?: string): void {
    const failed = !result.success

    if (pattern) {
      const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern
      const matches = regex.test(result.output)
      let actualValue: string
      if (!failed) {
        actualValue = 'command succeeded'
      } else if (matches) {
        actualValue = 'matched'
      } else {
        actualValue = `output: ${result.output.slice(0, 200)}`
      }
      this.assertions.push({
        description: message ?? `Command failed with expected error: ${pattern}`,
        passed: failed && matches,
        expected: `failure with error matching ${pattern}`,
        actual: actualValue,
      })
    } else {
      this.assertions.push({
        description: message ?? `Command failed: ${result.command}`,
        passed: failed,
        expected: 'non-zero exit code',
        actual: `exit code ${result.exitCode}`,
      })
    }
  }

  /**
   * Assert that a file exists and optionally matches content.
   *
   * @param path - The file path to check.
   * @param contentPattern - Optional regex or string to match file content.
   * @param message - Optional custom assertion message.
   */
  protected async assertFile(path: string, contentPattern?: RegExp | string, message?: string): Promise<void> {
    const fullPath = isAbsolutePath(path) ? path : joinPath(this.context.workingDirectory, path)
    const displayPath = relativePath(this.context.workingDirectory, fullPath)
    const exists = await fileExists(fullPath)

    if (!exists) {
      this.assertions.push({
        description: message ?? `File exists: ${displayPath}`,
        passed: false,
        expected: 'file exists',
        actual: 'file not found',
      })
      return
    }

    if (contentPattern) {
      const content = await readFile(fullPath)
      const regex = typeof contentPattern === 'string' ? new RegExp(contentPattern) : contentPattern
      const matches = regex.test(content)
      this.assertions.push({
        description: message ?? `File ${displayPath} matches ${contentPattern}`,
        passed: matches,
        expected: `content matching ${contentPattern}`,
        actual: matches ? 'matched' : `content: ${content.slice(0, 200)}...`,
      })
    } else {
      this.assertions.push({
        description: message ?? `File exists: ${displayPath}`,
        passed: true,
        expected: 'file exists',
        actual: 'file exists',
      })
    }
  }

  /**
   * Assert that a file does not exist.
   *
   * @param path - The file path to check.
   * @param message - Optional custom assertion message.
   */
  protected async assertNoFile(path: string, message?: string): Promise<void> {
    const fullPath = isAbsolutePath(path) ? path : joinPath(this.context.workingDirectory, path)
    const displayPath = relativePath(this.context.workingDirectory, fullPath)
    const exists = await fileExists(fullPath)
    this.assertions.push({
      description: message ?? `File does not exist: ${displayPath}`,
      passed: !exists,
      expected: 'file does not exist',
      actual: exists ? 'file exists' : 'file does not exist',
    })
  }

  /**
   * Assert that a directory exists.
   *
   * @param path - The directory path to check.
   * @param message - Optional custom assertion message.
   */
  protected async assertDirectory(path: string, message?: string): Promise<void> {
    const fullPath = isAbsolutePath(path) ? path : joinPath(this.context.workingDirectory, path)
    const displayPath = relativePath(this.context.workingDirectory, fullPath)
    const exists = await fileExists(fullPath)
    this.assertions.push({
      description: message ?? `Directory exists: ${displayPath}`,
      passed: exists,
      expected: 'directory exists',
      actual: exists ? 'directory exists' : 'directory not found',
    })
  }

  /**
   * Assert that output contains a pattern.
   *
   * @param result - The command result to check.
   * @param pattern - Regex or string pattern to match against output.
   * @param message - Optional custom assertion message.
   */
  protected assertOutput(result: CommandResult, pattern: RegExp | string, message?: string): void {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern
    const matches = regex.test(result.output)
    this.assertions.push({
      description: message ?? `Output matches ${pattern}`,
      passed: matches,
      expected: `output matching ${pattern}`,
      actual: matches ? 'matched' : `output: ${result.output.slice(0, 200)}`,
    })
  }

  /**
   * Assert that output contains valid JSON and optionally validate it.
   *
   * @param result - The command result to parse.
   * @param validator - Optional function to validate the parsed JSON.
   * @param message - Optional custom assertion message.
   */
  protected assertJson<T = unknown>(
    result: CommandResult,
    validator?: (json: T) => boolean,
    message?: string,
  ): T | undefined {
    try {
      const json = JSON.parse(result.stdout) as T
      if (validator) {
        const valid = validator(json)
        this.assertions.push({
          description: message ?? 'Output is valid JSON matching validator',
          passed: valid,
          expected: 'valid JSON matching validator',
          actual: valid ? 'matched' : 'validator returned false',
        })
      } else {
        this.assertions.push({
          description: message ?? 'Output is valid JSON',
          passed: true,
          expected: 'valid JSON',
          actual: 'valid JSON',
        })
      }
      return json
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch {
      this.assertions.push({
        description: message ?? 'Output is valid JSON',
        passed: false,
        expected: 'valid JSON',
        actual: `invalid JSON: ${result.stdout.slice(0, 100)}`,
      })
      return undefined
    }
  }

  /**
   * Assert a boolean condition.
   *
   * @param condition - The boolean condition to assert.
   * @param message - The assertion description.
   */
  protected assert(condition: boolean, message: string): void {
    this.assertions.push({
      description: message,
      passed: condition,
      expected: 'true',
      actual: String(condition),
    })
  }

  /**
   * Assert two values are equal.
   *
   * @param actual - The actual value.
   * @param expected - The expected value.
   * @param message - The assertion description.
   */
  protected assertEqual<T>(actual: T, expected: T, message: string): void {
    this.assertions.push({
      description: message,
      passed: actual === expected,
      expected: String(expected),
      actual: String(actual),
    })
  }

  private hasFailures(): boolean {
    return this.assertions.some((assertion) => !assertion.passed)
  }
}
