import {Command} from '@oclif/core'
import {output, dependency} from '@shopify/cli-kit'

export default class Version extends Command {
  static description = 'Shopify CLI version'

  async run(): Promise<void> {
    const currentVersion = this.getCurrentVersion()
    output.info(output.content`Current ${Version.description}: ${output.token.yellow(currentVersion)}`.value)
    const lastVersion = await dependency.checkForNewVersion('@shopify/cli', currentVersion)
    if (lastVersion) {
      output.info(output.content`Lastest ${Version.description}: ${output.token.yellow(lastVersion)}\n💡`)
      output.info(dependency.getOutputUpdateCLIReminder(dependency.dependencyManagerUsedForCreating()))
    }
  }

  getCurrentVersion(): string {
    return this.config.version
  }
}
