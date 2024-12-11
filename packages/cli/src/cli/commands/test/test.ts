import {globalFlags} from '@shopify/cli-kit/node/cli'
import BaseCommand from '@shopify/cli-kit/node/base-command'
import {Flags} from '@oclif/core'
import {chromium, Cookie, devices, type Page} from 'playwright'
import {outputInfo, outputContent, outputToken} from '@shopify/cli-kit/node/output'
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

    const browser = await chromium.launch({headless: false})
    const context = await browser.newContext(devices[flags.device])

    try {
      // Setup
      const page = await context.newPage()

      // The actual interesting bit
      await context.route('**.jpg', (route) => route.abort())

      await tryCollection(page, flags.url)
    } finally {
      // Teardown
      await context.close()
      await browser.close()
    }
  }
}

async function tryCollection(page: Page, baseUrl: string) {
  outputInfo('Full test')

  await page.goto(baseUrl)

  outputInfo(outputContent`    └─── ${outputToken.link('Goto', baseUrl)}`)

  await page.context().clearCookies({
    name: ANALYTICS_Y_COOKIE,
  })

  await page.context().clearCookies({
    name: ANALYTICS_S_COOKIE,
  })

  await acceptCookies(page)

  await loadCollection(page)

  await loadProduct(page)

  await addToCart(page)

  const cookies = await page.context().cookies()

  await checkout(page)

  await verifyCheckout(page, {cookies})
}

async function loadCollection(page: Page) {
  const collectionLinks = await page.locator(COLLECTION_LINK)

  if (!collectionLinks) {
    throw new Error('Collection link not found')
  }

  const href = await collectionLinks.first().getAttribute('href')

  console.log(`Loading collection: ${href}`)

  if (!href) {
    throw new Error('Collection link href not found')
  }

  await collectionLinks.first().click()
  const url = new URL(page.url())

  await page.waitForURL(`${url.origin + href}*`)
}

async function loadProduct(page: Page) {
  const productLinks = await page.locator(PRODUCT_LINK)

  if (!productLinks) {
    throw new Error('Product link not found')
  }

  const href = await productLinks.first().getAttribute('href')

  if (!href) {
    throw new Error('Product link href not found')
  }

  console.log(`Loading product: ${href}`)

  await productLinks.first().click()
  const url = new URL(page.url())

  await page.waitForURL(`${url.origin + href}*`, {})
}

async function addToCart(page: Page) {
  const addToCartButton = await page.locator(ADD_TO_CART_BUTTON)

  if (!addToCartButton) {
    throw new Error('Add to cart button not found')
  }

  console.log('Adding to cart')

  await addToCartButton.first().click()

  await page.waitForSelector(CHECKOUT_LINK)
}

async function checkout(page: Page) {
  const checkoutLink = await page.locator(CHECKOUT_LINK)

  if (!checkoutLink) {
    throw new Error('Checkout link not found')
  }

  console.log('Checking out')

  await checkoutLink.first().click()

  await page.waitForNavigation()
}

async function acceptCookies(page: Page) {
  if (!findCookie(await page.context().cookies(), ANALYTICS_Y_COOKIE)) {
    outputInfo(outputContent`    └─── ${'Accept cookies'}`)

    // there is no shopify analytics cookie, this means we need to accept cookies
    await page.locator(ACCEPT_COOKIES_BUTTON).click()
  }
}

async function verifyCheckout(page: Page, {cookies}: {cookies: Cookie[]}) {
  const checkoutCookies = await page.context().cookies()

  console.log('Verifying analytics cookies')

  assert(findCookie(checkoutCookies, ANALYTICS_Y_COOKIE) === findCookie(cookies, ANALYTICS_Y_COOKIE))
  assert(findCookie(checkoutCookies, ANALYTICS_S_COOKIE) === findCookie(cookies, ANALYTICS_S_COOKIE))
}

function findCookie(cookies: Cookie[], name: string) {
  return cookies.find((cookie) => cookie.name === name)?.value
}
