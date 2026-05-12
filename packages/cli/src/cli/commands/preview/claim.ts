import {claimPreviewStoreCommand} from '../../services/commands/preview/claim.js'
import Command from '@shopify/cli-kit/node/base-command'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {Flags} from '@oclif/core'

export default class PreviewStoreClaim extends Command {
  static summary = 'Generate a claim URL that transfers a Preview Store to a real merchant identity.'

  static description = `Calls Core's /services/preview-stores/claim endpoint, which wraps the existing org-based vibe transfer flow used today by Lovable. Returns a claim URL the recipient opens to take ownership of the store.`

  static examples = [
    '<%= config.bin %> <%= command.id %> --shop-id 21 --recipient-email merchant@example.com',
  ]

  static flags = {
    ...globalFlags,
    ...jsonFlag,
    'shop-id': Flags.integer({
      description: 'Numeric shop id returned by `preview create`.',
      env: 'SHOPIFY_FLAG_PREVIEW_STORE_SHOP_ID',
      required: true,
    }),
    'recipient-email': Flags.string({
      description: 'Email of the merchant identity that should take ownership after they accept the claim link.',
      env: 'SHOPIFY_FLAG_PREVIEW_STORE_RECIPIENT_EMAIL',
      required: true,
    }),
    'core-url': Flags.string({
      description: 'Base URL of the Core orchestrator. Defaults to https://app.shop.dev.',
      env: 'SHOPIFY_FLAG_PREVIEW_STORE_CORE_URL',
      required: false,
    }),
    'cli-username': Flags.string({
      description: 'Basic-auth username for the Core endpoint. Defaults to "preview-store-cli".',
      env: 'SHOPIFY_FLAG_PREVIEW_STORE_CLI_USERNAME',
      required: false,
    }),
    'cli-secret': Flags.string({
      description: 'Basic-auth secret for the Core endpoint. Defaults to the dev value "preview-store-cli-dev".',
      env: 'SHOPIFY_FLAG_PREVIEW_STORE_CLI_SECRET',
      required: false,
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(PreviewStoreClaim)

    await claimPreviewStoreCommand({
      shopId: flags['shop-id'],
      recipientEmail: flags['recipient-email'],
      json: Boolean(flags.json),
      client: {
        coreUrl: flags['core-url'],
        cliUsername: flags['cli-username'],
        cliSecret: flags['cli-secret'],
      },
    })
  }
}
