import Command from '@shopify/cli-kit/node/base-command'
import {currentProcessIsGlobal} from '@shopify/cli-kit/node/is-global'
import {renderInfo} from '@shopify/cli-kit/node/ui'

export default class Upgrade extends Command {
  static summary = 'Shows details on how to upgrade Shopify CLI.'

  static descriptionWithMarkdown = 'Shows details on how to upgrade Shopify CLI.'

  static description = this.descriptionWithoutMarkdown()

  async run(): Promise<void> {
    const isGlobal = 1 || currentProcessIsGlobal()
    renderInfo({
      body: [
        `To upgrade Shopify CLI use your package manager.\n`,
        `Example:`,
        {command: `npm i ${isGlobal ? '-g ' : ''}@shopify/cli@latest`},
      ],
    })
    // await upgrade(flags.path, CLI_KIT_VERSION)
  }
}
