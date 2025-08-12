import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {FunctionConfigType} from '../../models/extensions/specifications/function.js'
import {exec as cliKitExec} from '@shopify/cli-kit/node/system'
import {joinPath} from '@shopify/cli-kit/node/path'
import {existsSync, readdirSync} from 'fs'
import {loadConfigurationFileContent} from '../../models/app/loader.js'
import {Writable} from 'stream'
import {AbortSignal as CLIAbortSignal} from '@shopify/cli-kit/node/abort'
import {exec} from 'child_process'
import {promisify} from 'util'

export interface FunctionTestOptions {
  stdout: Writable
  stderr: Writable
  signal?: CLIAbortSignal
}

export async function getTestCommandFromToml(functionDirectory: string): Promise<string | undefined> {
  const tomlPath = joinPath(functionDirectory, 'shopify.extension.toml')

  if (!existsSync(tomlPath)) {
    return undefined
  }

  try {
    const tomlContent = await loadConfigurationFileContent(tomlPath)

    if (tomlContent.extensions && Array.isArray(tomlContent.extensions) && tomlContent.extensions[0]) {
      const extension = tomlContent.extensions[0] as {test?: {command?: string}}
      if (extension.test?.command) {
        return extension.test.command
      }
    }

    return undefined
  } catch {
    return undefined
  }
}

export async function runFunctionTestsIfExists(
  extension: ExtensionInstance<FunctionConfigType>,
  options: FunctionTestOptions
): Promise<void> {
  const testsDir = joinPath(extension.directory, 'tests')
  if (!existsSync(testsDir)) {
    options.stdout.write(`ℹ️  No tests found for function: ${extension.localIdentifier}\n`)
    options.stdout.write(`   Run 'shopify app function testgen' to generate test fixtures from previous function runs\n`)
    return
  }

  options.stdout.write(`Running tests for function: ${extension.localIdentifier}...\n`)
  await runFunctionTests(extension, options)
}

export async function runFunctionTests(
  extension: ExtensionInstance<FunctionConfigType>,
  options: FunctionTestOptions
): Promise<void> {
  try {
    const testCommand = await getTestCommandFromToml(extension.directory)

    if (testCommand) {
      const startTime = Date.now()
      const execAsync = promisify(exec)
      await execAsync(testCommand, {
        cwd: extension.directory,
      })
      const endTime = Date.now()
      const duration = (endTime - startTime) / 1000
      options.stdout.write(`✅ Tests completed in ${duration.toFixed(2)}s\n`)
    } else {
      options.stdout.write(`Debug: Using default vitest runner\n`)
      const testsDir = joinPath(extension.directory, 'tests')
      if (existsSync(testsDir)) {
        const testFiles = readdirSync(testsDir)
          .filter((file: string) => file.endsWith('.test.ts') || file.endsWith('.test.js'))

        if (testFiles.length > 0) {
          const startTime = Date.now()
          // Run vitest from the function directory, not the tests directory
          await cliKitExec('npx', ['vitest', 'run', 'tests'], {
            cwd: extension.directory,
            stdout: options.stdout,
            stderr: options.stderr,
            signal: options.signal,
          })
          const endTime = Date.now()
          const duration = (endTime - startTime) / 1000
          options.stdout.write(`✅ Tests completed in ${duration.toFixed(2)}s\n`)
        }
      }
    }
  } catch (error) {
    options.stderr.write(`Warning: Tests failed: ${error instanceof Error ? error.message : 'Unknown error'}\n`)
  }
}
