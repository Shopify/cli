import {Command} from '@oclif/core'
import {output, dependency} from '@shopify/cli-kit'

export default class Version extends Command {
  static description = 'Shopify CLI version'

  async run(): Promise<void> {
    const cliDependency = '@shopify/cli'
    const currentVersion = this.getCurrentVersion()
    output.info(output.content`Current ${Version.description}: ${output.token.yellow(currentVersion)}`.value)
    const lastVersion = await dependency.checkForNewVersion(cliDependency, currentVersion)
    if (lastVersion) {
      output.info(output.content`Latest ${Version.description}: ${output.token.yellow(lastVersion)}\n`)
      const reminder = dependency.getOutputUpdateCLIReminder(dependency.dependencyManagerUsedForCreating(), [
        cliDependency,
      ])
      output.info(`💡 ${reminder}`)
    }
  }

  getCurrentVersion(): string {
    return this.config.version
  }
}
