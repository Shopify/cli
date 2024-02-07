import {appFlags} from '../../flags.js'
import {AppInterface} from '../../models/app/app.js'
import {loadApp} from '../../models/app/loader.js'
import build from '../../services/build.js'
import Command from '../../utilities/app-command.js'
import {showApiKeyDeprecationWarning} from '../../prompts/deprecation-warnings.js'
import {loadLocalExtensionsSpecifications} from '../../models/extensions/load-specifications.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {addPublicMetadata} from '@shopify/cli-kit/node/metadata'

export default class Build extends Command {
  static description = 'Build the app.'

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

  async run(): Promise<void> {
    const {flags} = await this.parse(Build)
    if (flags['api-key']) {
      await showApiKeyDeprecationWarning()
    }
    const apiKey = flags['client-id'] || flags['api-key']

    await addPublicMetadata(() => ({
      cmd_app_dependency_installation_skipped: flags['skip-dependencies-installation'],
    }))

    const specifications = await loadLocalExtensionsSpecifications()
    const app: AppInterface = await loadApp({specifications, directory: flags.path, configName: flags.config})
    await build({app, skipDependenciesInstallation: flags['skip-dependencies-installation'], apiKey})
  }
}
