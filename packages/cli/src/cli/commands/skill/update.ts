import Command from '@shopify/cli-kit/node/base-command'
import {updateShopifySkill} from '@shopify/cli-kit/node/skills'
import {outputInfo} from '@shopify/cli-kit/node/output'

export default class SkillUpdate extends Command {
  static summary = 'Update the Shopify skill for coding agents when its source has changed.'

  async run(): Promise<void> {
    const result = await updateShopifySkill()

    switch (result) {
      case 'not-installed':
        outputInfo('The Shopify skill is not installed. Run `shopify skill install` to install it.')
        break
      case 'already-up-to-date':
        outputInfo('The Shopify skill is already up to date.')
        break
      case 'updated':
        outputInfo('The Shopify skill was updated to the latest version.')
        break
    }
  }
}
