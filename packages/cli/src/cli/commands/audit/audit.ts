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
        '  shopify audit theme       Run all theme command tests',
        '  shopify audit:theme:init  Run only theme init test',
        '',
        'Use --help with any command for more options.',
      ],
    })
  }
}
