import {globalFlags} from '@shopify/cli-kit/node/cli'
import BaseCommand from '@shopify/cli-kit/node/base-command'
import {Flags} from '@oclif/core'
import {chromium, Cookie, devices, type Page} from 'playwright'
import {outputInfo} from '@shopify/cli-kit/node/output'
import colors from '@shopify/cli-kit/node/colors'
import {renderError, renderSuccess} from '@shopify/cli-kit/node/ui'
import assert from 'node:assert'

const COLLECTION_LINK = '[data-shopify-collection-link]'
const PRODUCT_LINK = '[data-shopify-product-link]'
const ADD_TO_CART_BUTTON = '[data-shopify-product-add-to-cart]'
const CHECKOUT_LINK = '[data-shopify-cart-checkout-link]'
const CART_LINK = '[data-shopify-cart-link]'

const ACCEPT_COOKIES_BUTTON = '#shopify-pc__banner__btn-accept'
const SHOPIFY_CUSTOMER_PRIVACY = '#customer-privacy-api'

const ANALYTICS_Y_COOKIE = '_shopify_y'
const ANALYTICS_S_COOKIE = '_shopify_s'

interface TestFlags {
  url: string
  'skip-cookies': boolean
  'skip-collection': boolean
  device: string
  'no-color': boolean
  headless: boolean
  verbose: boolean
}

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
    headless: Flags.boolean({
      description: 'Run in headless mode',
      required: false,
      default: true,
      allowNo: true,
      env: 'SHOPIFY_FLAG_TEST_HEADLESS',
    }),
  }

  async run() {
    const {flags} = await this.parse(Test)

    if (!(flags.device in devices)) {
      throw new Error(`Invalid device: ${flags.device}.\nValid devices are: ${Object.keys(devices).join(', ')}`)
    }

    const browser = await chromium.launch({headless: flags.headless})
    const context = await browser.newContext(devices[flags.device])

    try {
      // Setup
      const page = await context.newPage()

      // The actual interesting bit
      await context.route('**.jpg', (route) => route.abort())

      await fullSuite(page, flags)
    } finally {
      // Teardown
      await context.close()
      await browser.close()
    }
  }
}

async function fullSuite(page: Page, flags: TestFlags) {
  const {url: baseUrl} = flags

  outputInfo(colors.blue`Full test`)

  process.stdout.write(`    ├ ${pad(`Go to: ${baseUrl.substring(0, baseUrl.indexOf('?') ?? baseUrl.length)}`)}`)

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

  if (!flags['skip-cookies']) {
    await page.context().clearCookies({
      name: ANALYTICS_Y_COOKIE,
    })

    await page.context().clearCookies({
      name: ANALYTICS_S_COOKIE,
    })

    await acceptCookies(page, flags)
  }

  if (!flags['skip-collection']) {
    await loadCollection(page, flags)
  }

  await loadProduct(page, flags)

  await addToCart(page, flags)

  const cookies = await page.context().cookies()

  await checkout(page, flags)

  await verifyCheckout(page, {cookies, flags})

  renderSuccess({
    headline: 'Validated to checkout.',
  })
}

async function loadCollection(page: Page, flags: TestFlags) {
  try {
    process.stdout.write(`    ├ Navigate to collection: `)

    const collectionLinks = await page.locator(COLLECTION_LINK)

    if (!collectionLinks) {
      throw new Error('Collection link not found')
    }

    const href = await collectionLinks.first().getAttribute('href')

    process.stdout.write(pad(`${href}`, 56))

    if (!href) {
      throw new Error('Collection link href not found')
    }

    await collectionLinks.first().click()
    const url = new URL(page.url())

    await page.waitForURL(`${url.origin + href}*`)

    printStepSuccess()
  } catch (error) {
    process.stdout.write('\n')
    renderError({
      headline: 'Unable to load a collection.',
      body: 'Make sure a link on the homepage with the `data-shopify-collection-link` attribute exists.\n Alternatively, you can skip this step by passing the --skip-collection flag.',
    })

    if (flags.verbose) {
      throw error
    } else {
      process.exit(1)
    }
  }
}

async function loadProduct(page: Page, flags: TestFlags) {
  try {
    process.stdout.write(`    ├ Navigate to product: `)

    const productLinks = await page.locator(PRODUCT_LINK)

    if (!productLinks) {
      throw new Error('Product link not found')
    }

    const href = await productLinks.first().getAttribute('href')

    if (!href) {
      throw new Error('Product link href not found')
    }

    process.stdout.write(pad(href, 59))

    await productLinks.first().click()
    const url = new URL(page.url())

    await page.waitForURL(`${url.origin + href}*`, {})

    printStepSuccess()
  } catch (error) {
    process.stdout.write('\n')
    renderError({
      headline: 'Unable to load a product.',
      body: 'Make sure your product links have the `data-shopify-product-link` attribute.',
    })

    if (flags.verbose) {
      throw error
    } else {
      process.exit(1)
    }
  }
}

async function addToCart(page: Page, flags: TestFlags) {
  try {
    process.stdout.write(`    ├ ${pad(`Add to cart 🛒 `)}`)

    const addToCartButton = await page.locator(ADD_TO_CART_BUTTON)

    if (!addToCartButton) {
      throw new Error('Add to cart button not found')
    }

    await addToCartButton.first().click()

    await page.waitForSelector(CHECKOUT_LINK)

    printStepSuccess()
  } catch (error) {
    process.stdout.write('\n')
    renderError({
      headline: 'Unable to add to cart.',
      body: 'Make sure your product add to cart button has the `data-shopify-product-add-to-cart` attribute.',
    })

    if (flags.verbose) {
      throw error
    } else {
      process.exit(1)
    }
  }
}

async function checkout(page: Page, flags: TestFlags) {
  try {
    process.stdout.write(`    ├ ${pad(`Navigate: checkout 🧾 `)}`)
    const checkoutLink = await page.locator(CHECKOUT_LINK)

    if (!checkoutLink) {
      throw new Error('Checkout link not found')
    }

    await checkoutLink.first().click()

    await page.waitForNavigation()

    printStepSuccess()
  } catch (error) {
    process.stdout.write('\n')
    renderError({
      headline: 'Unable to navigate to checkout.',
      body: 'Make sure your checkout link has the `data-shopify-cart-checkout-link` attribute.',
    })

    if (flags.verbose) {
      throw error
    } else {
      process.exit(1)
    }
  }
}

async function acceptCookies(page: Page, flags: TestFlags) {
  try {
    if (!findCookie(await page.context().cookies(), ANALYTICS_Y_COOKIE)) {
      process.stdout.write(`    ├ ${pad('Cookie consent 🍪 ')}`)
      // there is no shopify analytics cookie, this means we need to accept cookies
      await page.locator(ACCEPT_COOKIES_BUTTON).click()

      printStepSuccess()
    }
  } catch (error) {
    process.stdout.write('\n')
    renderError({
      headline: 'Unable to accept consent for cookies.',
      body: 'If you are using custom consent, you can skip this step by passing the --skip-cookies flag.',
    })

    if (flags.verbose) {
      throw error
    } else {
      process.exit(1)
    }
  }
}

async function verifyCheckout(page: Page, {cookies, flags}: {cookies: Cookie[]; flags: TestFlags}) {
  process.stdout.write(`    ├ ${pad(`Validate analytics 📊 `)}`)
  const checkoutCookies = await page.context().cookies()

  if (!flags['skip-cookies']) {
    assert(findCookie(checkoutCookies, ANALYTICS_Y_COOKIE) === findCookie(cookies, ANALYTICS_Y_COOKIE))
    assert(findCookie(checkoutCookies, ANALYTICS_S_COOKIE) === findCookie(cookies, ANALYTICS_S_COOKIE))
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
