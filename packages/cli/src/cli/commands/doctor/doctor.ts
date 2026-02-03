import Command from '@shopify/cli-kit/node/base-command'
import {renderInfo} from '@shopify/cli-kit/node/ui'

export default class Doctor extends Command {
  static description = 'Run CLI doctor tests'
  static hidden = true

  async run(): Promise<void> {
    renderInfo({
      headline: 'Shopify CLI Doctor.',
      body: [
        'Available doctor commands:',
        '',
        '  shopify doctor theme -e <environment>   Run all theme command tests',
        '',
        'The -e/--environment flag is required to specify the store configuration.',
        'Use --help with any command for more options.',
      ],
    })
  }
}
