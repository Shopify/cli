import {globalFlags} from '@shopify/cli-kit/node/cli'
import BaseCommand from '@shopify/cli-kit/node/base-command'
import {Flags} from '@oclif/core'
import {chromium, devices} from 'playwright'
import assert from 'node:assert'

export default class Test extends BaseCommand {
  static summary = 'Test a Shopify storefront'

  static descriptionWithMarkdown = `This commands executes an end-to-end test suite for a Shopify storefront.`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    url: Flags.string({
      description: 'The URL of the storefront to test',
      required: true,
      aliases: ['u'],
      env: 'SHOPIFY_FLAG_TEST_URL',
    }),
    device: Flags.string({
      description: 'The device to test on',
      required: false,
      default: 'iPhone 11',
      options: Object.keys(devices),
      env: 'SHOPIFY_FLAG_TEST_DEVICE',
    }),
  }

  async run() {
    const {flags} = await this.parse(Test)

    if (!(flags.device in devices)) {
      throw new Error(`Invalid device: ${flags.device}.\nValid devices are: ${Object.keys(devices).join(', ')}`)
    }

    const browser = await chromium.launch()
    const context = await browser.newContext(devices[flags.device])

    try {
      // Setup
      const page = await context.newPage()

      // The actual interesting bit
      await context.route('**.jpg', (route) => route.abort())
      await page.goto(flags.url)

      assert((await page.title()) === 'Home | Hydrogen Demo Store')
    } finally {
      // Teardown
      await context.close()
      await browser.close()
    }
  }
}
