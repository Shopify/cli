import {appFlags} from '../../flags.js'
import {AppInterface} from '../../models/app/app.js'
import {load as loadApp} from '../../models/app/loader.js'
import build from '../../services/build.js'
import Command from '../../utilities/app-command.js'
import {loadExtensionsSpecifications} from '../../models/extensions/specifications.js'
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
      hidden: false,
      description: "Application's API key that will be exposed at build time.",
      env: 'SHOPIFY_FLAG_API_KEY',
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Build)

    await addPublicMetadata(() => ({
      cmd_app_dependency_installation_skipped: flags['skip-dependencies-installation'],
    }))

    const specifications = await loadExtensionsSpecifications(this.config)
    const app: AppInterface = await loadApp({specifications, directory: flags.path})
    await build({app, skipDependenciesInstallation: flags['skip-dependencies-installation'], apiKey: flags['api-key']})
  }
}
