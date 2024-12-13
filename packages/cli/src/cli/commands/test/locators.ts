import {TestFlags} from './test.types.js'
import {Locator, Page} from 'playwright'
import {joinPath, cwd} from '@shopify/cli-kit/node/path'
import {renderError} from '@shopify/cli-kit/node/ui'

const ADD_TO_CART_BUTTON = '[data-shopify-product-add-to-cart]'
const CHECKOUT_LINK = '[data-shopify-cart-checkout-link]'
const ACCEPT_COOKIES_BUTTON = '#shopify-pc__banner__btn-accept'
const COLLECTION_LINK = '[data-shopify-collection-link]'
const PRODUCT_LINK = '[data-shopify-product-link]'

type LocatorFunction = ({page, flags}: {page: Page; flags: TestFlags}) => Promise<Locator>

export interface Locators {
  addToCartButton: LocatorFunction
  productLink: LocatorFunction
  checkoutLink: LocatorFunction
  collectionLink: LocatorFunction
  acceptCookiesButton: LocatorFunction
}

export async function buildLocators({flags}: {flags: TestFlags}): Promise<Locators> {
  try {
    const customLocators = flags.locators ? await import(joinPath(cwd(), flags.locators)) : null

    const locators = {
      addToCartButton: customLocators?.locateAddToCartButton || locateAddToCartButton,
      productLink: customLocators?.locateProductLink || locateProductLink,
      checkoutLink: customLocators?.locateCheckoutLink || locateCheckoutLink,
      collectionLink: customLocators?.locateCollectionLink || locateCollectionLink,
      acceptCookiesButton: customLocators?.locateAcceptCookiesButton || locateAcceptCookiesButton,
    }

    return locators
  } catch (error) {
    renderError({
      headline: 'Unable to find locators file.',
      body: `File: ${joinPath(cwd(), flags.locators)}`,
    })

    if (flags.verbose) {
      throw error
    } else {
      process.exit(1)
    }
  }
}

async function locateAddToCartButton({page}: {page: Page; flags: TestFlags}) {
  return page.locator(ADD_TO_CART_BUTTON)
}

async function locateProductLink({page}: {page: Page; flags: TestFlags}) {
  return page.locator(PRODUCT_LINK)
}

async function locateCheckoutLink({page}: {page: Page; flags: TestFlags}) {
  return page.locator(CHECKOUT_LINK)
}

async function locateCollectionLink({page}: {page: Page; flags: TestFlags}) {
  return page.locator(COLLECTION_LINK)
}

async function locateAcceptCookiesButton({page}: {page: Page; flags: TestFlags}) {
  return page.locator(ACCEPT_COOKIES_BUTTON)
}
