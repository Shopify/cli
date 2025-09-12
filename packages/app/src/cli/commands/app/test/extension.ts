import {runExtensionTests} from '../../../services/app/test/extension.js'
import {chooseExtension} from '../../../services/extensions/common.js'
import {appFlags} from '../../../flags.js'
import {showApiKeyDeprecationWarning} from '../../../prompts/deprecation-warnings.js'
import AppLinkedCommand, {AppLinkedCommandOutput} from '../../../utilities/app-linked-command.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {Flags} from '@oclif/core'
import {resolvePath, cwd} from '@shopify/cli-kit/node/path'

export default class ExtensionTest extends AppLinkedCommand {
  static hidden = true
  static summary = 'Run tests for a specific extension.'
  static descriptionWithMarkdown = `Runs tests for a single extension that has test commands defined in its \`shopify.extension.toml\` file.

Extensions can define test commands in their configuration:

\`\`\`toml
[[extensions]]
name = "my-extension"
type = "function"

[extensions.tests]
command = "npm test"
\`\`\`

Only extensions with explicit test commands can be tested.`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    ...appFlags,
    'api-key': Flags.string({
      hidden: true,
      description: "Application's API key",
      env: 'SHOPIFY_FLAG_API_KEY',
      exclusive: ['config'],
    }),
    'skip-build': Flags.boolean({
      description: 'Skip building the extension and just run tests.',
      env: 'SHOPIFY_FLAG_SKIP_BUILD',
    }),
    path: Flags.string({
      hidden: false,
      description: 'The path to your extension directory.',
      parse: async (input) => resolvePath(input),
      default: async () => cwd(),
      noCacheDefault: true,
      env: 'SHOPIFY_FLAG_PATH',
    }),
  }

  public async run(): Promise<AppLinkedCommandOutput> {
    const {flags} = await this.parse(ExtensionTest)
    if (flags['api-key']) {
      await showApiKeyDeprecationWarning()
    }

    const {app} = await linkedAppContext({
      directory: flags.path,
      clientId: flags['client-id'] ?? flags['api-key'],
      forceRelink: flags.reset,
      userProvidedConfigName: flags.config,
    })

    const extension = await chooseExtension(app.allExtensions, flags.path)

    await runExtensionTests([extension], {
      stdout: process.stdout,
      stderr: process.stderr,
      skipBuild: flags['skip-build'],
      app,
    })

    return {app}
  }
}
