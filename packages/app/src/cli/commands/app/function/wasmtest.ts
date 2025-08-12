import {chooseFunction, functionFlags} from '../../../services/function/common.js'
import {runFunctionTests, runFunctionTestsIfExists} from '../../../services/function/test-runner.js'
import {appFlags} from '../../../flags.js'
import {showApiKeyDeprecationWarning} from '../../../prompts/deprecation-warnings.js'
import AppLinkedCommand, {AppLinkedCommandOutput} from '../../../utilities/app-linked-command.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {Flags} from '@oclif/core'
import { buildFunctionExtension } from '../../../services/build/extension.js'

export default class FunctionWasmtest extends AppLinkedCommand {
  static summary = 'Builds the function and runs all tests in the test folder.'

  static descriptionWithMarkdown = `Builds the function to WebAssembly and then automatically runs tests if a \`tests\` folder exists. This is useful for ensuring your function works correctly before deployment.

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

    await runFunctionTestsIfExists(ourFunction, {
      stdout: process.stdout,
      stderr: process.stderr,
    })

    return {app}
  }
}
