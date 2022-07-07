import {Command} from '@oclif/core'
import {output} from '@shopify/cli-kit'
import {checkForNewVersion, packageManagerUsedForCreating} from '@shopify/cli-kit/node/node-package-manager'

export default class Version extends Command {
  static description = 'Shopify CLI version'

  async run(): Promise<void> {
    const cliDependency = '@shopify/cli'
    const currentVersion = this.getCurrentVersion()
    output.info(output.content`Current ${Version.description}: ${output.token.yellow(currentVersion)}`.value)
    const lastVersion = await checkForNewVersion(cliDependency, currentVersion)
    if (lastVersion) {
      output.info(output.getOutputUpdateCLIReminder(packageManagerUsedForCreating(), lastVersion))
    }
  }

  getCurrentVersion(): string {
    return this.config.version
  }
}
