import {appFlags} from '../../flags.js'
import build from '../../services/build.js'
import {showApiKeyDeprecationWarning} from '../../prompts/deprecation-warnings.js'
import AppCommand, {AppCommandOutput} from '../../utilities/app-command.js'
import {linkedAppContext} from '../../services/app-context.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {addPublicMetadata} from '@shopify/cli-kit/node/metadata'

export default class Build extends AppCommand {
  static summary = 'Build the app, including extensions.'

  static descriptionWithMarkdown = `This command executes the build script specified in the element's TOML file. You can specify a custom script in the file. To learn about configuration files in Shopify apps, refer to [App configuration](https://shopify.dev/docs/apps/tools/cli/configuration).

  If you're building a [theme app extension](https://shopify.dev/docs/apps/online-store/theme-app-extensions), then running the \`build\` command runs [Theme Check](https://shopify.dev/docs/themes/tools/theme-check) against your extension to ensure that it's valid.`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    ...appFlags,
    'skip-dependencies-installation': Flags.boolean({
      hidden: false,
      description: 'Skips the installation of dependencies. Deprecated, use workspaces instead.',
      env: 'SHOPIFY_FLAG_SKIP_DEPENDENCIES_INSTALLATION',
      default: false,
    }),
    'api-key': Flags.string({
      hidden: true,
      description: "Application's API key that will be exposed at build time.",
      env: 'SHOPIFY_FLAG_API_KEY',
      exclusive: ['config'],
    }),
    'client-id': Flags.string({
      hidden: false,
      description: "Application's Client ID that will be exposed at build time.",
      env: 'SHOPIFY_FLAG_CLIENT_ID',
      exclusive: ['config'],
    }),
  }

  async run(): Promise<AppCommandOutput> {
    const {flags} = await this.parse(Build)
    if (flags['api-key']) {
      await showApiKeyDeprecationWarning()
    }
    const apiKey = flags['client-id'] || flags['api-key']

    await addPublicMetadata(() => ({
      cmd_app_dependency_installation_skipped: flags['skip-dependencies-installation'],
    }))

    const {app} = await linkedAppContext({
      directory: flags.path,
      clientId: flags['client-id'],
      forceRelink: false,
      userProvidedConfigName: flags.config,
    })

    await build({app, skipDependenciesInstallation: flags['skip-dependencies-installation'], apiKey})

    return {app}
  }
}
