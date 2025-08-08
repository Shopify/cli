import {chooseFunction, functionFlags} from '../../../services/function/common.js'
import {buildFunctionExtension} from '../../../services/build/extension.js'
import {appFlags} from '../../../flags.js'
import {showApiKeyDeprecationWarning} from '../../../prompts/deprecation-warnings.js'
import AppLinkedCommand, {AppLinkedCommandOutput} from '../../../utilities/app-linked-command.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {loadConfigurationFileContent} from '../../../models/app/loader.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {Flags} from '@oclif/core'
import {joinPath} from '@shopify/cli-kit/node/path'
import {exec} from '@shopify/cli-kit/node/system'
import {existsSync, readdirSync} from 'fs'

/**
 * Reads the shopify.extension.toml file and extracts the test command if defined
 */
async function getTestCommandFromToml(functionDirectory: string): Promise<string | undefined> {
  const tomlPath = joinPath(functionDirectory, 'shopify.extension.toml')

  if (!existsSync(tomlPath)) {
    return undefined
  }

    try {
    const tomlContent = await loadConfigurationFileContent(tomlPath)

    // Check for test command in extensions[].test.command
    if (tomlContent.extensions && Array.isArray(tomlContent.extensions) && tomlContent.extensions[0]) {
      const extension = tomlContent.extensions[0] as {test?: {command?: string}}
      if (extension.test?.command) {
        return extension.test.command
      }
    }

    return undefined
  } catch {
    // If we can't read the TOML file, just return undefined
    return undefined
  }
}

export default class FunctionWasmtest extends AppLinkedCommand {
  static summary = 'Builds the function and runs all tests in the test folder.'

  static descriptionWithMarkdown = `Builds the function to WebAssembly and then runs all tests in the test folder. This is useful for ensuring your function works correctly before deployment.

If a test command is specified in your \`shopify.extension.toml\` file under \`[extensions.test]\`, that command will be used instead of the default vitest runner:

\`\`\`toml
[[extensions]]
name = "my-function"
handle = "my-function"
type = "function"

  [extensions.test]
  command = "npx vitest run"
\`\`\`

If no custom test command is found, the command will automatically discover and run \`.test.ts\` and \`.test.js\` files using vitest.`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    ...appFlags,
    ...functionFlags,
    'api-key': Flags.string({
      hidden: true,
      description: "Application's API key",
      env: 'SHOPIFY_FLAG_API_KEY',
      exclusive: ['config'],
    }),
    'skip-build': Flags.boolean({
      description: 'Skip building the function and just run tests.',
      env: 'SHOPIFY_FLAG_SKIP_BUILD',
    }),
  }

  public async run(): Promise<AppLinkedCommandOutput> {
    const {flags} = await this.parse(FunctionWasmtest)
    if (flags['api-key']) {
      await showApiKeyDeprecationWarning()
    }

    const {app} = await linkedAppContext({
      directory: flags.path,
      clientId: flags['client-id'] ?? flags['api-key'],
      forceRelink: flags.reset,
      userProvidedConfigName: flags.config,
    })

    const ourFunction = await chooseFunction(app, flags.path)

    if (!flags['skip-build']) {
      await buildFunctionExtension(ourFunction, {
        stdout: process.stdout,
        stderr: process.stderr,
        app,
        environment: 'production',
      })
    }

    // Step 2: Run tests
    const testsDir = joinPath(ourFunction.directory, 'tests')
    if (!existsSync(testsDir)) {
      throw new Error(
        `No tests directory found at ${testsDir}. Run 'shopify app function testgen' first to create test fixtures.`,
      )
    }

    // Check for custom test command in shopify.extension.toml
    const testCommand = await getTestCommandFromToml(ourFunction.directory)

    if (testCommand) {
      // Use custom test command from TOML
      try {
        // Parse the command string into command and args
        const commandParts = testCommand.split(' ')
        const command = commandParts[0]!
        const args = commandParts.slice(1)

        await exec(command, args, {
          cwd: testsDir,
          env: {
            ...process.env,
            NODE_ENV: 'test',
          },
          stdout: 'inherit',
          stderr: 'inherit',
        })
      } catch (error) {
        if (error instanceof Error) {
          throw new Error(`Custom test command failed: ${error.message}`)
        } else {
          throw new Error('Custom test command failed with unknown error')
        }
      }
    } else {
      // Default behavior: find test files and run with vitest
      const testFiles = readdirSync(testsDir).filter(
        (file: string) => file.endsWith('.test.ts') || file.endsWith('.test.js'),
      )

      if (testFiles.length === 0) {
        throw new Error(
          `No test files found in ${testsDir}. Run 'shopify app function testgen' first to create test fixtures.`,
        )
      }

      // Run tests using vitest
      try {
        await exec('npx', ['vitest', 'run', ...testFiles], {
          cwd: testsDir,
          env: {
            ...process.env,
            NODE_ENV: 'test',
          },
          stdout: 'inherit',
          stderr: 'inherit',
        })
      } catch (error) {
        if (error instanceof Error) {
          throw new Error(`Tests failed: ${error.message}`)
        } else {
          throw new Error('Tests failed with unknown error')
        }
      }
    }

    return {app}
  }
}
