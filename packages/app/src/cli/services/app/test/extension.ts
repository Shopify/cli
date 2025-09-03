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

  outputInfo(`🧪 Found ${testableExtensions.length} extension(s) with test commands`)

  // Run test command for each extension
  await Promise.all(testableExtensions.map((extension) => orchestrateExtensionTest(extension, options)))

  // Show completion message
  outputInfo('✅ All extension tests completed')
}

function hasTestConfiguration(extension: ExtensionInstance): boolean {
  const config = extension.configuration as ExtensionConfigWithTests
  return Boolean(config.tests?.command)
}

async function orchestrateExtensionTest(extension: ExtensionInstance, options: ExtensionTestOptions): Promise<void> {
  const config = extension.configuration as ExtensionConfigWithTests

  await useConcurrentOutputContext({outputPrefix: extension.outputPrefix, stripAnsi: false}, async () => {
    options.stdout.write(`\n🔍 Testing extension: ${extension.localIdentifier}\n`)
  })

  // Check for test command first - no point building if there's no test to run
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

  // Build extension if needed
  await buildExtensionForTesting(extension, options)

  // Run test command
  await runExtensionTestCommand(extension, testCommand, options)
}

async function buildExtensionForTesting(extension: ExtensionInstance, options: ExtensionTestOptions): Promise<void> {
  await useConcurrentOutputContext({outputPrefix: extension.outputPrefix, stripAnsi: false}, async () => {
    // Build extension if not skipping build and app context is available
    if (!options.skipBuild && options.app) {
      options.stdout.write(`🔨 Building extension ${extension.handle}...\n`)

      const startTime = Date.now()
      await extension.build({
        stdout: options.stdout,
        stderr: options.stderr,
        app: options.app,
        environment: 'production',
      })

      const endTime = Date.now()
      const duration = (endTime - startTime) / 1000
      options.stdout.write(`✅ Extension built successfully in ${duration.toFixed(2)}s\n`)
    } else if (!options.skipBuild) {
      options.stdout.write(`⚠️  Skipping build (no app context available)\n`)
    } else {
      options.stdout.write(`✅ Skipping build\n`)
    }
  })
}

async function runExtensionTestCommand(
  extension: ExtensionInstance,
  testCommand: string,
  options: ExtensionTestOptions,
): Promise<void> {
  await useConcurrentOutputContext({outputPrefix: extension.outputPrefix, stripAnsi: false}, async () => {
    options.stdout.write(`🔧 Executing test command: ${testCommand}\n`)

    const startTime = Date.now()
    try {
      await exec('sh', ['-c', testCommand], {
        cwd: extension.directory,
        stdout: options.stdout,
        stderr: options.stderr,
        signal: options.signal,
      })

      const endTime = Date.now()
      const duration = (endTime - startTime) / 1000
      options.stdout.write(`✅ Test command completed successfully in ${duration.toFixed(2)}s\n`)
    } catch (error) {
      const endTime = Date.now()
      const duration = (endTime - startTime) / 1000
      options.stdout.write(`❌ Test command failed after ${duration.toFixed(2)}s\n`)
      throw new Error(
        `Test command failed for ${extension.localIdentifier}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      )
    }
  })
}
