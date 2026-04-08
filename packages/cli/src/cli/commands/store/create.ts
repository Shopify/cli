import {createStore} from '../../services/store/create/index.js'
import Command from '@shopify/cli-kit/node/base-command'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderSuccess, renderInfo} from '@shopify/cli-kit/node/ui'
import {Flags} from '@oclif/core'

export default class StoreCreate extends Command {
  static summary = 'Create a new Shopify store.'

  static descriptionWithMarkdown = `Creates a new Shopify store associated with your account.

By default, creates a trial store. Use \`--dev\` to create a development store instead.`

  static description = this.descriptionWithoutMarkdown()

  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --name "My Store" --country US',
    '<%= config.bin %> <%= command.id %> --name "My Dev Store" --dev',
    '<%= config.bin %> <%= command.id %> --name "My Store" --json',
  ]

  static flags = {
    ...globalFlags,
    ...jsonFlag,
    name: Flags.string({
      char: 'n',
      description: 'The name of the store.',
      env: 'SHOPIFY_FLAG_STORE_NAME',
    }),
    subdomain: Flags.string({
      description: 'The custom myshopify.com subdomain for the store.',
      env: 'SHOPIFY_FLAG_STORE_SUBDOMAIN',
    }),
    country: Flags.string({
      char: 'c',
      description: 'The country code for the store (e.g., US, CA, GB).',
      env: 'SHOPIFY_FLAG_STORE_COUNTRY',
      default: 'US',
    }),
    dev: Flags.boolean({
      description: 'Create a development store instead of a trial store.',
      env: 'SHOPIFY_FLAG_STORE_DEV',
      default: false,
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(StoreCreate)

    const result = await createStore({
      name: flags.name,
      subdomain: flags.subdomain,
      country: flags.country,
      dev: flags.dev,
    })

    if (flags.json) {
      outputResult(JSON.stringify(result, null, 2))
      return
    }

    renderSuccess({
      headline: 'Store created successfully.',
      body: `Domain: ${result.shopPermanentDomain}`,
      nextSteps: [
        ...(result.shopLoginUrl ? [`Open your store: ${result.shopLoginUrl}`] : []),
        `Run ${['shopify', 'app', 'dev', '--store', result.shopPermanentDomain].join(' ')} to start developing`,
      ],
    })

    if (result.polling) {
      renderInfo({body: 'Your store is still being configured. It may take a moment before it is fully ready.'})
    }
  }
}
