import Command from '@shopify/cli-kit/node/base-command'
import {firstPartyDev} from '@shopify/cli-kit/node/context/local'
import {renderInfo} from '@shopify/cli-kit/node/ui'

export default class DoctorRelease extends Command {
  static description = 'Run CLI doctor-release tests'
  static hidden = true

  async run(): Promise<void> {
    if (!firstPartyDev()) {
      return
    }

    renderInfo({
      headline: 'Shopify CLI Doctor Release.',
      body: [
        'Available doctor-release commands:',
        '',
        '  shopify doctor-release theme -e <environment>   Run all theme command tests',
        '',
        'The -e/--environment flag is required to specify the store configuration.',
        'Use --help with any command for more options.',
      ],
    })
  }
}
