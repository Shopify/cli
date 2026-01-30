import {fileExists, readFile} from '@shopify/cli-kit/node/fs'
import {joinPath, relativePath} from '@shopify/cli-kit/node/path'
import {exec, captureOutput} from '@shopify/cli-kit/node/system'
import type {AuditContext, TestResult, AssertionResult} from './types.js'

/**
 * Result from running a CLI command
 */
interface CommandResult {
  /** The full command that was run */
  command: string
  /** Exit code (0 = success) */
  exitCode: number
  /** Standard output */
  stdout: string
  /** Standard error */
  stderr: string
  /** Combined output (stdout + stderr) */
  output: string
  /** Whether the command succeeded (exitCode === 0) */
  success: boolean
}

/**
 * Base class for audit test suites.
 *
 * Write tests as methods starting with "test":
 *
 * ```typescript
 * export default class MyTests extends AuditSuite {
 *   static description = 'My test suite'
 *
 *   async 'test basic case'() {
 *     const result = await this.run('shopify theme init')
 *     this.assertSuccess(result)
 *   }
 *
 *   async 'test error case'() {
 *     const result = await this.run('shopify theme init --invalid')
 *     this.assertError(result, /unknown flag/)
 *   }
 * }
 * ```
 */
export abstract class AuditSuite {
  static description = 'Audit test suite'

  protected context!: AuditContext
  private assertions: AssertionResult[] = []

  /**
   * Run the entire test suite
   */
  async runSuite(context: AuditContext): Promise<TestResult[]> {
    this.context = context
    const results: TestResult[] = []

    // Find all methods starting with "test"
    const testMethods = this.getTestMethods()

    for (const methodName of testMethods) {
      this.assertions = []
      const startTime = Date.now()

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, no-await-in-loop
        await (this as any)[methodName]()

        results.push({
          name: methodName,
          status: this.hasFailures() ? 'failed' : 'passed',
          duration: Date.now() - startTime,
          assertions: [...this.assertions],
        })
        // eslint-disable-next-line no-catch-all/no-catch-all
      } catch (error) {
        results.push({
          name: methodName,
          status: 'failed',
          duration: Date.now() - startTime,
          assertions: [...this.assertions],
          error: error instanceof Error ? error : new Error(String(error)),
        })
      }
    }

    return results
  }

  // ============================================
  // Command execution
  // ============================================

  /**
   * Run a CLI command and return the result.
   *
   * @example
   * const result = await this.run('shopify theme init my-theme')
   * const result = await this.run('shopify theme push --json')
   */
  protected async run(
    command: string,
    options?: {cwd?: string; env?: {[key: string]: string}},
  ): Promise<CommandResult> {
    const parts = command.split(' ').filter(Boolean)
    const cmd = parts[0]
    if (!cmd) {
      throw new Error("Command can't be empty")
    }
    const args = parts.slice(1)
    const cwd = options?.cwd ?? this.context.workingDirectory

    let stdout = ''
    let stderr = ''
    let exitCode = 0

    try {
      stdout = await captureOutput(cmd, args, {cwd, env: options?.env})
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (error) {
      // captureOutput throws on non-zero exit
      if (error instanceof Error) {
        stderr = error.message
        // Try to extract exit code from error
        const match = /exit code (\d+)/i.exec(error.message)
        const exitCodeStr = match?.[1]
        exitCode = exitCodeStr ? parseInt(exitCodeStr, 10) : 1
      } else {
        exitCode = 1
      }
    }

    return {
      command,
      exitCode,
      stdout,
      stderr,
      output: stdout + stderr,
      success: exitCode === 0,
    }
  }

  /**
   * Run a command without capturing output (for interactive commands).
   * Returns only success/failure.
   */
  protected async runInteractive(
    command: string,
    options?: {cwd?: string; env?: {[key: string]: string}},
  ): Promise<CommandResult> {
    const parts = command.split(' ').filter(Boolean)
    const cmd = parts[0]
    if (!cmd) {
      throw new Error("Command can't be empty")
    }
    const args = parts.slice(1)
    const cwd = options?.cwd ?? this.context.workingDirectory

    let exitCode = 0

    try {
      await exec(cmd, args, {cwd, env: options?.env, stdin: 'inherit'})
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

  // ============================================
  // Assertions
  // ============================================

  /**
   * Assert that a command succeeded (exit code 0)
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
   * Assert that a command failed with an error matching the pattern
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
   * Assert that a file exists and optionally matches content
   */
  protected async assertFile(path: string, contentPattern?: RegExp | string, message?: string): Promise<void> {
    const fullPath = path.startsWith('/') ? path : joinPath(this.context.workingDirectory, path)
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
   * Assert that a file does not exist
   */
  protected async assertNoFile(path: string, message?: string): Promise<void> {
    const fullPath = path.startsWith('/') ? path : joinPath(this.context.workingDirectory, path)
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
   * Assert that a directory exists
   */
  protected async assertDirectory(path: string, message?: string): Promise<void> {
    const fullPath = path.startsWith('/') ? path : joinPath(this.context.workingDirectory, path)
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
   * Assert that output contains a pattern
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
   * Assert that output contains valid JSON and optionally validate it
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
   * Assert a boolean condition
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
   * Assert two values are equal
   */
  protected assertEqual<T>(actual: T, expected: T, message: string): void {
    this.assertions.push({
      description: message,
      passed: actual === expected,
      expected: String(expected),
      actual: String(actual),
    })
  }

  /**
   * Get all test method names from this class
   */
  private getTestMethods(): string[] {
    const methods: string[] = []
    let proto = Object.getPrototypeOf(this)

    while (proto && proto !== Object.prototype) {
      const names = Object.getOwnPropertyNames(proto)
      for (const name of names) {
        if (name.startsWith('test')) {
          const descriptor = Object.getOwnPropertyDescriptor(proto, name)
          if (descriptor && typeof descriptor.value === 'function') {
            methods.push(name)
          }
        }
      }
      proto = Object.getPrototypeOf(proto)
    }

    return methods
  }

  private hasFailures(): boolean {
    return this.assertions.some((assertion) => !assertion.passed)
  }
}
