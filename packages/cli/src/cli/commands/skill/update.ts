import Command from '@shopify/cli-kit/node/base-command'
import {updateShopifySkill} from '@shopify/cli-kit/node/skills'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {Flags} from '@oclif/core'

export default class SkillUpdate extends Command {
  static summary = 'Update the Shopify skill for coding agents when its source has changed.'

  static flags = {
    background: Flags.boolean({
      description: 'Announce a performed update on the next CLI run instead of the current output.',
      env: 'SHOPIFY_FLAG_BACKGROUND',
      default: false,
      hidden: true,
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(SkillUpdate)
    const result = await updateShopifySkill({announceOnNextRun: flags.background})

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
