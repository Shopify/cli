import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {FunctionConfigType} from '../../models/extensions/specifications/function.js'
import {AppLinkedInterface} from '../../models/app/app.js'
import {exec as cliKitExec} from '@shopify/cli-kit/node/system'
import {joinPath} from '@shopify/cli-kit/node/path'
import {existsSync, readdirSync} from 'fs'
import {loadConfigurationFileContent} from '../../models/app/loader.js'
import {Writable} from 'stream'
import {AbortSignal as CLIAbortSignal} from '@shopify/cli-kit/node/abort'
import {exec} from 'child_process'
import {promisify} from 'util'
import {outputInfo, outputDebug} from '@shopify/cli-kit/node/output'
import { useConcurrentOutputContext } from '@shopify/cli-kit/node/ui/components'

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
    await useConcurrentOutputContext({outputPrefix: extension.outputPrefix, stripAnsi: false}, async () => {
      options.stdout.write(`ℹ️  No tests found for function: ${extension.localIdentifier}\n`)
      options.stdout.write(`   Run 'shopify app function testgen' to generate test fixtures from previous function runs\n`)
    })
    return
  }

  await useConcurrentOutputContext({outputPrefix: extension.outputPrefix, stripAnsi: false}, async () => {
    options.stdout.write(`Running tests for function: ${extension.localIdentifier}...\n`)
  })
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
      try {
        await execAsync(testCommand, {
          cwd: extension.directory,
        })
        const endTime = Date.now()
        const duration = (endTime - startTime) / 1000
        await useConcurrentOutputContext({outputPrefix: extension.outputPrefix, stripAnsi: false}, async () => {
          options.stdout.write(`✅ Tests completed in ${duration.toFixed(2)}s\n`)
        })
      } catch (error) {
        throw new Error(`Custom test command failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    } else {
      await useConcurrentOutputContext({outputPrefix: extension.outputPrefix, stripAnsi: false}, async () => {
        outputDebug(`Using default vitest runner`)
      })
      const testsDir = joinPath(extension.directory, 'tests')
      if (existsSync(testsDir)) {
        const testFiles = readdirSync(testsDir)
          .filter((file: string) => file.endsWith('.test.ts') || file.endsWith('.test.js'))

        if (testFiles.length > 0) {
          const startTime = Date.now()

          const customStdout = new Writable({
            write(chunk: Buffer, encoding: string, callback: (error?: Error | null) => void) {
              useConcurrentOutputContext({outputPrefix: extension.outputPrefix, stripAnsi: false}, () => {
                options.stdout.write(chunk)
              })
              callback()
            }
          })

          const customStderr = new Writable({
            write(chunk: Buffer, encoding: string, callback: (error?: Error | null) => void) {
              useConcurrentOutputContext({outputPrefix: extension.outputPrefix, stripAnsi: false}, () => {
                options.stderr.write(chunk)
              })
              callback()
            }
          })

          await cliKitExec('npx', ['vitest', 'run', 'tests'], {
            cwd: extension.directory,
            stdout: customStdout,
            stderr: customStderr,
            signal: options.signal,
          })

          const endTime = Date.now()
          const duration = (endTime - startTime) / 1000
          await useConcurrentOutputContext({outputPrefix: extension.outputPrefix, stripAnsi: false}, async () => {
            options.stdout.write(`✅ Tests completed in ${duration.toFixed(2)}s\n`)
          })
        }
      }
    }
  } catch (error) {
    throw new Error(`Tests failed for function ${extension.localIdentifier}: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

export async function runTestsForExtensions(app: AppLinkedInterface, options?: Partial<FunctionTestOptions>): Promise<void> {
  const functionExtensions = app.allExtensions.filter((ext) => ext.isFunctionExtension)
  for (const extension of functionExtensions) {
    await runFunctionTestsIfExists(extension as unknown as ExtensionInstance<FunctionConfigType>, {
      stdout: options?.stdout ?? process.stdout,
      stderr: options?.stderr ?? process.stderr,
      signal: options?.signal,
    })
  }
}
