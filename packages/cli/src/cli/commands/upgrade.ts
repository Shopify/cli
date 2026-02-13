import {cliInstallCommand} from '@shopify/cli-kit/shared/node/upgrade'
import Command from '@shopify/cli-kit/shared/node/base-command'
import {renderInfo} from '@shopify/cli-kit/shared/node/ui'

export default class Upgrade extends Command {
  static summary = 'Shows details on how to upgrade Shopify CLI.'

  static descriptionWithMarkdown = 'Shows details on how to upgrade Shopify CLI.'

  static description = this.descriptionWithoutMarkdown()

  async run(): Promise<void> {
    renderInfo({
      body: [`To upgrade Shopify CLI use your package manager.\n`, `Example:`, {command: cliInstallCommand()}],
    })
  }
}
