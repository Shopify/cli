import {type CreatePreviewStoreResult, createPreviewStoreCommand} from '../../../services/store/create/preview/index.js'
import {writeCreatePreviewStoreResult} from '../../../services/store/create/preview/result.js'
import StoreCommand from '../../../utilities/store-command.js'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {outputContent} from '@shopify/cli-kit/node/output'
import {renderSingleTask} from '@shopify/cli-kit/node/ui'
import {Flags} from '@oclif/core'

export default class StoreCreatePreview extends StoreCommand {
  static summary = 'Create a preview Shopify store.'

  static descriptionWithMarkdown = `Creates a new preview Shopify store for a merchant who wants to try Shopify without needing to immediately create an account.`

  static description = this.descriptionWithoutMarkdown()

  static examples = [
    '<%= config.bin %> <%= command.id %> --name "Lavender Candles"',
    '<%= config.bin %> <%= command.id %> --name "Lavender Candles" --country US',
    '<%= config.bin %> <%= command.id %> --name "Lavender Candles" --json',
  ]

  static flags = {
    ...globalFlags,
    ...jsonFlag,
    name: Flags.string({
      description: 'The name of the store.',
      env: 'SHOPIFY_FLAG_PREVIEW_STORE_NAME',
      required: false,
    }),
    country: Flags.string({
      description: 'Two-letter ISO 3166-1 alpha-2 country code for the store, such as US, CA, or GB.',
      env: 'SHOPIFY_FLAG_PREVIEW_STORE_COUNTRY',
      required: false,
      parse: async (value) => value.trim().toUpperCase(),
    }),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(StoreCreatePreview)

    if (flags.country !== undefined && !isCountryCode(flags.country)) {
      this.error('Country must be a two-letter ISO country code, for example: US.')
    }

    const result = await renderSingleTask<CreatePreviewStoreResult>({
      title: outputContent`Creating store…`,
      task: async () => createPreviewStoreCommand({name: flags.name, country: flags.country}),
    })

    writeCreatePreviewStoreResult(result, flags.json ? 'json' : 'text')
  }
}

function isCountryCode(value: string): boolean {
  return /^[A-Z]{2}$/.test(value)
}
