import {TestFlags} from './test.types.js'
import {buildLocators, type Locators} from './locators.js'
import {waitForNetworkIdle} from './utils.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import BaseCommand from '@shopify/cli-kit/node/base-command'
import {Flags} from '@oclif/core'
import {chromium, Cookie, devices, type Page, errors} from 'playwright'
import {outputInfo} from '@shopify/cli-kit/node/output'
import colors from '@shopify/cli-kit/node/colors'
import {renderError, renderSuccess, renderWarning} from '@shopify/cli-kit/node/ui'

const ANALYTICS_Y_COOKIE = '_shopify_y'
const ANALYTICS_S_COOKIE = '_shopify_s'

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
      default: 'Desktop Chrome',
      options: Object.keys(devices),
      env: 'SHOPIFY_FLAG_TEST_DEVICE',
    }),
    'skip-cookies': Flags.boolean({
      description: 'Skip validating cookies and consent',
      required: false,
      default: false,
      env: 'SHOPIFY_FLAG_TEST_SKIP_COOKIES',
    }),
    'skip-collection': Flags.boolean({
      description: 'Skip validating collection page',
      required: false,
      default: false,
      env: 'SHOPIFY_FLAG_TEST_SKIP_COLLECTION',
    }),
    'no-headless': Flags.boolean({
      description: 'Run without headless mode',
      required: false,
      default: false,
      env: 'SHOPIFY_FLAG_TEST_NO_HEADLESS',
    }),
    locators: Flags.string({
      description:
        'The path to the test configuration file. If not provided, a default file will be generated at shopify-test-locators.js',
      required: false,
      default: '',
      env: 'SHOPIFY_FLAG_TEST_CONFIG',
    }),
  }

  async run() {
    const {flags} = await this.parse(Test)

    if (!(flags.device in devices)) {
      throw new Error(`Invalid device: ${flags.device}.\nValid devices are: ${Object.keys(devices).join(', ')}`)
    }

    const browser = await chromium.launch({
      headless: !flags['no-headless'],
    })
    const context = await browser.newContext(devices[flags.device])

    const locators = await buildLocators({flags})

    try {
      // Setup
      const page = await context.newPage()

      await fullSuite({page, flags, locators})
    } finally {
      // Teardown
      await browser.close()
    }
  }
}

async function fullSuite({page, flags, locators}: {page: Page; flags: TestFlags; locators: Locators}) {
  const {url: baseUrl} = flags

  outputInfo(colors.blue`Full test`)

  const searchIndex = baseUrl.indexOf('?')

  process.stdout.write(`    ├ ${pad(`Go to: ${searchIndex === -1 ? baseUrl : baseUrl.substring(0, searchIndex)}`)}`)

  try {
    await page.goto(baseUrl)
  } catch (error) {
    process.stdout.write('\n')
    renderError({
      headline: 'Unable to load storefront.',
    })
    throw error
  }

  printStepSuccess()

  await waitForNetworkIdle(page)

  if (!flags['skip-cookies']) {
    await acceptCookies({page, flags, locators})
  }

  if (!flags['skip-collection']) {
    await loadCollection({page, flags, locators})
  }

  await loadProduct({page, flags, locators})

  await addToCart({page, flags, locators})

  const cookies = await page.context().cookies()

  await checkout({page, flags, locators})

  await verifyCheckout({page, cookies, flags})

  renderSuccess({
    headline: 'Validated to checkout.',
  })
}

async function loadCollection({page, flags, locators}: {page: Page; flags: TestFlags; locators: Locators}) {
  try {
    process.stdout.write(`    ├ 🏪 Navigate to collection: `)

    const collectionLinks = await locators.collectionLink({page, flags})

    if (!collectionLinks) {
      throw new Error('Collection link not found')
    }

    const href = await collectionLinks.filter({visible: true}).first().getAttribute('href')

    process.stdout.write(pad(`${href}`, 53))

    if (!href) {
      throw new Error('Collection link href not found')
    }

    await collectionLinks.filter({visible: true}).first().click({force: true})
    const url = new URL(page.url())

    await page.waitForURL(`${url.origin + href}*`)

    printStepSuccess()
  } catch (error) {
    process.stdout.write('\n')
    renderError({
      headline: 'Unable to navigate to collection.',
      body: `Make sure the locateCollectionLink function returns a valid locator.\n\nError: ${
        error instanceof Error ? error.message : error
      }`,
    })

    if (flags.verbose) {
      throw error
    } else {
      process.exit(1)
    }
  }
}

async function loadProduct({page, flags, locators}: {page: Page; flags: TestFlags; locators: Locators}) {
  try {
    process.stdout.write(`    ├ 📦 Navigate to product: `)

    const productLinks = await locators.productLink({page, flags})

    if (!productLinks) {
      throw new Error('Product link not found')
    }

    const product = await productLinks.filter({visible: true}).first()
    const href = await product.getAttribute('href')

    if (!href) {
      throw new Error('Product link href not found')
    }

    process.stdout.write(pad(href, 56))

    await product.click()

    await waitForNetworkIdle(page)

    printStepSuccess()
  } catch (error) {
    process.stdout.write('\n')
    renderError({
      headline: 'Unable to navigate to product.',
      body: `Make sure the locateProductLink function returns a valid locator.\n\nError: ${
        error instanceof Error ? error.message : error
      }`,
    })

    if (flags.verbose) {
      throw error
    } else {
      process.exit(1)
    }
  }
}

async function addToCart({page, flags, locators}: {page: Page; flags: TestFlags; locators: Locators}) {
  try {
    process.stdout.write(`    ├ ${pad(`🛒 Add to cart `)}`)

    await waitForNetworkIdle(page)

    const addToCartButton = await locators.addToCartButton({page, flags})

    if (!addToCartButton) {
      throw new Error('Add to cart button not found')
    }

    await addToCartButton.filter({visible: true}).first().click()

    await waitForNetworkIdle(page)

    printStepSuccess()
  } catch (error) {
    process.stdout.write('\n')
    renderError({
      headline: 'Unable to add to cart.',
      body: `Make sure the locateAddToCartButton function returns a valid locator.\n\nError: ${
        error instanceof Error ? error.message : error
      }`,
    })

    if (flags.verbose) {
      throw error
    } else {
      process.exit(1)
    }
  }
}

async function checkout({page, flags, locators}: {page: Page; flags: TestFlags; locators: Locators}) {
  try {
    process.stdout.write(`    ├ ${pad(`🧾 Navigate: checkout `)}`)
    const checkoutLink = await locators.checkoutLink({page, flags})

    if (!checkoutLink) {
      throw new Error('Checkout link not found')
    }

    await checkoutLink.filter({visible: true}).first().click()

    await page.waitForLoadState('domcontentloaded')

    printStepSuccess()
  } catch (error) {
    process.stdout.write('\n')
    renderError({
      headline: 'Unable to navigate to checkout.',
      body: `Make sure the locateCheckoutLink function returns a valid locator.\n\nError: ${
        error instanceof Error ? error.message : error
      }`,
    })

    if (flags.verbose) {
      throw error
    } else {
      process.exit(1)
    }
  }
}

async function acceptCookies({page, flags, locators}: {page: Page; flags: TestFlags; locators: Locators}) {
  try {
    process.stdout.write(`    ├ ${pad('🍪 Cookie consent ')}`)
    // there is no shopify analytics cookie, this means we need to accept cookies
    const cookiesButton = await locators.acceptCookiesButton({page, flags})
    await cookiesButton.filter({visible: true}).first().click()

    printStepSuccess()
  } catch (error) {
    if (error instanceof errors.TimeoutError) {
      process.stdout.write('\n')
      renderWarning({
        headline: 'Unable to accept consent for cookies.',
        body: 'If you are using custom consent, you can skip this step by passing the --skip-cookies flag.',
      })

      if (flags.verbose) {
        renderWarning({
          headline: 'Cookie consent error.',
          body: (error as Error)?.message,
        })
      }
    } else {
      throw error
    }
  }
}

async function verifyCheckout({page, cookies, flags}: {cookies: Cookie[]; flags: TestFlags; page: Page}) {
  process.stdout.write(`    ├ ${pad(`📊 Validate analytics `)}`)
  const checkoutCookies = await page.context().cookies()

  if (!flags['skip-cookies']) {
    if (
      findCookie(checkoutCookies, ANALYTICS_Y_COOKIE) !== findCookie(cookies, ANALYTICS_Y_COOKIE) ||
      findCookie(checkoutCookies, ANALYTICS_S_COOKIE) !== findCookie(cookies, ANALYTICS_S_COOKIE)
    ) {
      process.stdout.write('\n')
      renderError({
        headline: 'Analytics cookies not found.',
        body: "Analytics are broken on the checkout page. The analytics cookies set on the primary domain don't match the cookies on the checkout page. This means that order attribution is broken.",
      })

      process.exit(1)
    }
  }

  printStepSuccess()
}

function findCookie(cookies: Cookie[], name: string) {
  return cookies.find((cookie) => cookie.name === name)?.value
}

function pad(text: string, length = 80) {
  return text + colors.gray(text.padEnd(length, '.').substring(text.length))
}

function printStepSuccess() {
  process.stdout.write(` ${colors.green`✔\n`}`)
}
