import {appFlags} from '../../flags'
import {load as loadApp, App} from '../../models/app/app'
import {Command} from '@oclif/core'
import {cli, dependency, output, path} from '@shopify/cli-kit'

export default class AppUpgrade extends Command {
  static description = 'Upgrade Shopify CLI in your app'

  static flags = {
    ...cli.globalFlags,
    ...appFlags,
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(AppUpgrade)
    const directory = flags.path ? path.resolve(flags.path) : process.cwd()
    const app: App = await loadApp(directory, 'report')
    const cliDependency = '@shopify/cli'
    const currentVersion = app.nodeDependencies[cliDependency]
    const newestVersion = await dependency.checkForNewVersion(cliDependency, currentVersion)

    if (!newestVersion) {
      output.info(`You're on the latest version, ${currentVersion}, no need to upgrade!`)
      return
    }

    output.info(`Upgrading CLI from ${currentVersion} to ${newestVersion}...`)
    await dependency.addLatestNPMDependencies([cliDependency, '@shopify/app'], {
      dependencyManager: app.dependencyManager,
      type: 'prod',
      directory: app.directory,
    })
  }
}
