import {createPreviewStoreCommand} from '../../../services/store/create/preview/index.js'
import {writeCreatePreviewStoreResult} from '../../../services/store/create/preview/result.js'
import StoreCommand from '../../../utilities/store-command.js'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {Flags} from '@oclif/core'

export default class StoreCreatePreview extends StoreCommand {
  static summary = 'Create a Preview Store backed by a placeholder identity.'

  static descriptionWithMarkdown = `Creates a Preview Store via the Core preview-stores orchestrator. The returned admin API token is persisted locally as a stored store-auth session, so the new store can be used immediately as a target for \`shopify store execute --store <permanent-domain>\` without any further login.

The orchestrator endpoint, basic-auth username, and basic-auth secret default to the local development rig values used by the M1 prototype. Override them with \`--core-url\`, \`--cli-username\`, and \`--cli-secret\` (or the corresponding \`SHOPIFY_FLAG_*\` environment variables) when targeting a non-default environment.`

  static description = this.descriptionWithoutMarkdown()

  static examples = [
    '<%= config.bin %> <%= command.id %> --shop-name my-preview',
    '<%= config.bin %> <%= command.id %> --shop-name my-preview --email demo@previewstore.invalid',
    '<%= config.bin %> <%= command.id %> --shop-name my-preview --json',
  ]

  static flags = {
    ...globalFlags,
    ...jsonFlag,
    'shop-name': Flags.string({
      char: 'n',
      description: 'Subdomain prefix for the new preview store. Auto-generated if omitted.',
      env: 'SHOPIFY_FLAG_PREVIEW_STORE_SHOP_NAME',
      required: false,
    }),
    email: Flags.string({
      description:
        'Email to associate with the placeholder identity. Defaults to a generated `@previewstore.invalid` address chosen by Core.',
      env: 'SHOPIFY_FLAG_PREVIEW_STORE_EMAIL',
      required: false,
    }),
    country: Flags.string({
      description: 'ISO country code for the new store. Defaults to "US".',
      env: 'SHOPIFY_FLAG_PREVIEW_STORE_COUNTRY',
      required: false,
    }),
    'core-url': Flags.string({
      description: 'Base URL of the Core preview-stores orchestrator. Defaults to the local development rig.',
      env: 'SHOPIFY_FLAG_PREVIEW_STORE_CORE_URL',
      required: false,
    }),
    'cli-username': Flags.string({
      description: 'Basic-auth username for the Core endpoint. Defaults to the development rig value.',
      env: 'SHOPIFY_FLAG_PREVIEW_STORE_CLI_USERNAME',
      required: false,
    }),
    'cli-secret': Flags.string({
      description: 'Basic-auth secret for the Core endpoint. Defaults to the development rig value.',
      env: 'SHOPIFY_FLAG_PREVIEW_STORE_CLI_SECRET',
      required: false,
    }),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(StoreCreatePreview)

    const shopName = flags['shop-name'] ?? generateDefaultShopName()

    const result = await createPreviewStoreCommand({
      shopName,
      email: flags.email,
      country: flags.country,
      client: {
        coreUrl: flags['core-url'],
        cliUsername: flags['cli-username'],
        cliSecret: flags['cli-secret'],
      },
    })

    writeCreatePreviewStoreResult(result, flags.json ? 'json' : 'text')
  }
}

function generateDefaultShopName(): string {
  return `preview-${Math.floor(Date.now() / 1000)}`
}
