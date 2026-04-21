import {devWithOverrideFile} from '../../services/dev-override.js'
import {Flags} from '@oclif/core'
import Command from '@shopify/cli-kit/node/base-command'
import {globalFlags} from '@shopify/cli-kit/node/cli'

export default class SandboxPreview extends Command {
  static summary = 'Opens a one-shot authless mock.shop sandbox preview from a JSON overrides file.'

  static usage = ['theme sandbox-preview --overrides path/to/overrides.json']

  static descriptionWithMarkdown = `Starts an authless, one-shot sandbox preview using [mock.shop](https://mock.shop/).

This prototype writes a local launcher page and opens it in your browser. The launcher then POSTs the override payload directly to the target storefront to render an initial preview.

- No store authentication is required
- No preview is persisted
- Navigation after the first page load will not preserve overrides`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    overrides: Flags.string({
      description: 'Path to a JSON overrides file.',
      env: 'SHOPIFY_FLAG_OVERRIDES',
      required: true,
    }),
    'no-open': Flags.boolean({
      description: 'Do not automatically launch the local storefront preview launcher in your default web browser.',
      env: 'SHOPIFY_FLAG_NO_OPEN',
      default: false,
    }),
    'storefront-url': Flags.string({
      description: 'Override the storefront preview target. Useful for local SFR testing.',
      env: 'SHOPIFY_FLAG_STOREFRONT_URL',
      required: false,
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(SandboxPreview)

    await devWithOverrideFile({
      overrideJson: flags.overrides,
      open: !flags['no-open'],
      mockShop: true,
      mockShopStorefrontUrl: flags['storefront-url'],
    })
  }
}
