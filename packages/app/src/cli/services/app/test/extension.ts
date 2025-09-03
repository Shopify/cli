import {AppLinkedInterface} from '../../../models/app/app.js'
import {ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {BaseConfigType} from '../../../models/extensions/schemas.js'
import {exec} from '@shopify/cli-kit/node/system'
import {AbortSignal as CLIAbortSignal} from '@shopify/cli-kit/node/abort'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {useConcurrentOutputContext} from '@shopify/cli-kit/node/ui/components'
import {Writable} from 'stream'

interface ExtensionTestOptions {
  stdout: Writable
  stderr: Writable
  signal?: CLIAbortSignal
  skipBuild?: boolean
  app?: AppLinkedInterface
}

interface ExtensionConfigWithTests extends BaseConfigType {
  tests?: {
    command: string
  }
}

export async function runExtensionTests(extensions: ExtensionInstance[], options: ExtensionTestOptions): Promise<void> {
  if (extensions.length === 0) {
    outputInfo('ℹ️  No extensions provided for testing')
    return
  }

  // Filter for extensions with test configurations
  const testableExtensions = extensions.filter(hasTestConfiguration)

  if (testableExtensions.length === 0) {
    outputInfo('ℹ️  No extensions with test commands found')
    outputInfo('   Add [extensions.tests] command = "your-test-command" to your extension TOML files to enable testing')
    return
  }

  // Show summary for multiple extensions
  if (testableExtensions.length > 1) {
    outputInfo(`🧪 Found ${testableExtensions.length} extension(s) with test commands`)
  }

  // Run test command for each extension
  await Promise.all(testableExtensions.map((extension) => runExtensionTestCommand(extension, options)))

  // Show completion message for multiple extensions
  if (testableExtensions.length > 1) {
    outputInfo('✅ All extension tests completed')
  }
}

function hasTestConfiguration(extension: ExtensionInstance): boolean {
  const config = extension.configuration as ExtensionConfigWithTests
  return Boolean(config.tests?.command)
}

async function runExtensionTestCommand(extension: ExtensionInstance, options: ExtensionTestOptions): Promise<void> {
  const config = extension.configuration as ExtensionConfigWithTests

  await useConcurrentOutputContext({outputPrefix: extension.outputPrefix, stripAnsi: false}, async () => {
    options.stdout.write(`\n🔍 Testing extension: ${extension.localIdentifier}\n`)
  })

  // Build extension if not skipping build and app context is available
  if (!options.skipBuild && options.app) {
    await useConcurrentOutputContext({outputPrefix: extension.outputPrefix, stripAnsi: false}, async () => {
      options.stdout.write(`🔨 Building extension...\n`)
    })

    const startTime = Date.now()
    await extension.build({
      stdout: options.stdout,
      stderr: options.stderr,
      app: options.app,
      environment: 'production',
    })

    const endTime = Date.now()
    const duration = (endTime - startTime) / 1000

    await useConcurrentOutputContext({outputPrefix: extension.outputPrefix, stripAnsi: false}, async () => {
      options.stdout.write(`✅ Extension built successfully in ${duration.toFixed(2)}s\n`)
    })
  } else if (!options.skipBuild) {
    await useConcurrentOutputContext({outputPrefix: extension.outputPrefix, stripAnsi: false}, async () => {
      options.stdout.write(`⚠️  Skipping build (no app context available)\n`)
    })
  } else {
    await useConcurrentOutputContext({outputPrefix: extension.outputPrefix, stripAnsi: false}, async () => {
      options.stdout.write(`✅ Skipping build\n`)
    })
  }

  // Check for test command
  const testCommand = config.tests?.command

  if (!testCommand) {
    await useConcurrentOutputContext({outputPrefix: extension.outputPrefix, stripAnsi: false}, async () => {
      options.stdout.write(`ℹ️  No test command configured for this extension\n`)
      options.stdout.write(
        `   Add [extensions.tests] command = "your-test-command" to the extension's TOML file to enable testing\n`,
      )
    })
    return
  }

  // Run test command
  await runTestCommand(extension, testCommand, options)
}

async function runTestCommand(
  extension: ExtensionInstance,
  testCommand: string,
  options: ExtensionTestOptions,
): Promise<void> {
  await useConcurrentOutputContext({outputPrefix: extension.outputPrefix, stripAnsi: false}, async () => {
    options.stdout.write(`🔧 Executing test command: ${testCommand}\n`)
  })

  const customStdout = new Writable({
    write(chunk: Buffer, _encoding: string, callback: (error?: Error | null) => void) {
      useConcurrentOutputContext({outputPrefix: extension.outputPrefix, stripAnsi: false}, () => {
        options.stdout.write(chunk)
      })
      callback()
    },
  })

  const customStderr = new Writable({
    write(chunk: Buffer, _encoding: string, callback: (error?: Error | null) => void) {
      useConcurrentOutputContext({outputPrefix: extension.outputPrefix, stripAnsi: false}, () => {
        options.stderr.write(chunk)
      })
      callback()
    },
  })

  const startTime = Date.now()
  try {
    await exec('sh', ['-c', testCommand], {
      cwd: extension.directory,
      stdout: customStdout,
      stderr: customStderr,
      signal: options.signal,
    })

    const endTime = Date.now()
    const duration = (endTime - startTime) / 1000
    await useConcurrentOutputContext({outputPrefix: extension.outputPrefix, stripAnsi: false}, async () => {
      options.stdout.write(`✅ Test command completed successfully in ${duration.toFixed(2)}s\n`)
    })
  } catch (error) {
    const endTime = Date.now()
    const duration = (endTime - startTime) / 1000
    await useConcurrentOutputContext({outputPrefix: extension.outputPrefix, stripAnsi: false}, async () => {
      options.stdout.write(`❌ Test command failed after ${duration.toFixed(2)}s\n`)
    })
    throw new Error(
      `Test command failed for ${extension.localIdentifier}: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
    )
  }
}
