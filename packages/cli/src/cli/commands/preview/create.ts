import {createPreviewStoreCommand} from '../../services/commands/preview/create.js'
import Command from '@shopify/cli-kit/node/base-command'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {Flags} from '@oclif/core'

export default class PreviewStoreCreate extends Command {
  static summary = 'Create a Preview Store backed by a placeholder identity.'

  static description = `Calls Core's /services/preview-stores orchestrator. Returns a shop, an Admin API token, and a one-time-use magic-link URL the user can open to land in admin without an Identity login.

Targets a local Core rig by default (https://app.shop.dev). Override --core-url to point elsewhere.`

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
      description: 'Subdomain prefix for the new preview store (e.g. "my-preview"). Auto-generated if omitted.',
      env: 'SHOPIFY_FLAG_PREVIEW_STORE_SHOP_NAME',
      required: false,
    }),
    email: Flags.string({
      description: 'Email to associate with the placeholder identity. Defaults to a generated @previewstore.invalid address.',
      env: 'SHOPIFY_FLAG_PREVIEW_STORE_EMAIL',
      required: false,
    }),
    country: Flags.string({
      description: 'ISO country code for the new store. Defaults to US.',
      env: 'SHOPIFY_FLAG_PREVIEW_STORE_COUNTRY',
      required: false,
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
    const {flags} = await this.parse(PreviewStoreCreate)

    const shopName = flags['shop-name'] ?? `preview-${Math.floor(Date.now() / 1000)}`

    await createPreviewStoreCommand({
      shopName,
      email: flags.email,
      country: flags.country,
      json: Boolean(flags.json),
      client: {
        coreUrl: flags['core-url'],
        cliUsername: flags['cli-username'],
        cliSecret: flags['cli-secret'],
      },
    })
  }
}
