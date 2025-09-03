import {runExtensionTests} from '../../services/app/test/extension.js'
import {appFlags} from '../../flags.js'
import {showApiKeyDeprecationWarning} from '../../prompts/deprecation-warnings.js'
import AppLinkedCommand, {AppLinkedCommandOutput} from '../../utilities/app-linked-command.js'
import {linkedAppContext} from '../../services/app-context.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {Flags} from '@oclif/core'

export default class AppTest extends AppLinkedCommand {
  static hidden = true
  static summary = 'Run tests for all extensions in the app.'
  static descriptionWithMarkdown = `Runs tests for all extensions that have test commands defined in their \`shopify.extension.toml\` files.

Extensions can define test commands in their configuration:

\`\`\`toml
[[extensions]]
name = "my-extension"
type = "function"

[extensions.tests]
command = "npm test"
\`\`\`

Only extensions with explicit test commands will be tested.`

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
      description: 'Skip building extensions and just run tests.',
      env: 'SHOPIFY_FLAG_SKIP_BUILD',
    }),
  }

  public async run(): Promise<AppLinkedCommandOutput> {
    const {flags} = await this.parse(AppTest)
    if (flags['api-key']) {
      await showApiKeyDeprecationWarning()
    }

    const {app} = await linkedAppContext({
      directory: flags.path,
      clientId: flags['client-id'] ?? flags['api-key'],
      forceRelink: flags.reset,
      userProvidedConfigName: flags.config,
    })

    await runExtensionTests(app.allExtensions, {
      stdout: process.stdout,
      stderr: process.stderr,
      skipBuild: flags['skip-build'],
      app,
    })

    return {app}
  }
}
