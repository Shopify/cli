import Command from '@shopify/cli-kit/node/base-command'
import {renderInfo} from '@shopify/cli-kit/node/ui'

export default class Audit extends Command {
  static description = 'Run CLI audit tests'
  static hidden = true

  async run(): Promise<void> {
    renderInfo({
      headline: 'Shopify CLI Audit.',
      body: [
        'Available audit commands:',
        '',
        '  shopify audit theme -e <environment>   Run all theme command tests',
        '',
        'The -e/--environment flag is required to specify the store configuration.',
        'Use --help with any command for more options.',
      ],
    })
  }
}
