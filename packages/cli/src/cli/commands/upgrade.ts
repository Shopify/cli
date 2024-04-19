import Command from '@shopify/cli-kit/node/base-command'
import {currentProcessIsGlobal, inferPackageManagerForGlobalCLI} from '@shopify/cli-kit/node/is-global'
import {packageManagerFromUserAgent} from '@shopify/cli-kit/node/node-package-manager'
import {renderInfo} from '@shopify/cli-kit/node/ui'

export default class Upgrade extends Command {
  static summary = 'Shows details on how to upgrade Shopify CLI.'

  static descriptionWithMarkdown = 'Shows details on how to upgrade Shopify CLI.'

  static description = this.descriptionWithoutMarkdown()

  async run(): Promise<void> {
    const isGlobal = currentProcessIsGlobal()
    let packageManager = packageManagerFromUserAgent() ?? inferPackageManagerForGlobalCLI()
    if (packageManager === 'unknown') packageManager = 'npm'

    let installCommand = `${packageManager} i ${isGlobal ? '-g ' : ''}@shopify/cli@latest`
    if (packageManager === 'yarn') {
      installCommand = `yarn ${isGlobal ? 'global ' : ''}add @shopify/cli@latest`
    }

    renderInfo({
      body: [`To upgrade Shopify CLI use your package manager.\n`, `Example:`, {command: installCommand}],
    })
  }
}
