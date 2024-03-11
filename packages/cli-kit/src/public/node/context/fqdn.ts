import {isSpinEnvironment, spinFqdn} from './spin.js'
import {AbortError} from '../error.js'
import {serviceEnvironment} from '../../../private/node/context/service.js'

export const CouldntObtainPartnersSpinFQDNError = new AbortError(
  "Couldn't obtain the Spin FQDN for Partners when the CLI is not running from a Spin environment.",
)
export const CouldntObtainIdentitySpinFQDNError = new AbortError(
  "Couldn't obtain the Spin FQDN for Identity when the CLI is not running from a Spin environment.",
)
export const CouldntObtainShopifySpinFQDNError = new AbortError(
  "Couldn't obtain the Spin FQDN for Shopify when the CLI is not running from a Spin environment.",
)
export const NotProvidedStoreFQDNError = new AbortError(
  "Couldn't obtain the Shopify FQDN because the store FQDN was not provided.",
)

/**
 * It returns the Partners' API service we should interact with.
 *
 * @returns Fully-qualified domain of the partners service we should interact with.
 */
export async function partnersFqdn(): Promise<string> {
  const environment = serviceEnvironment()
  const productionFqdn = 'partners.shopify.com'
  switch (environment) {
    case 'local':
      return 'partners.myshopify.io'
    case 'spin':
      return `partners.${await spinFqdn()}`
    default:
      return productionFqdn
  }
}

/**
 * It returns the Shopify Developers' API service we should interact with.
 *
 * @returns Fully-qualified domain of the Shopify Developers service we should interact with.
 */
export async function shopifyDevelopersFqdn(): Promise<string> {
  const environment = serviceEnvironment()
  const productionFqdn = 'shopify.com'
  switch (environment) {
    case 'local':
      return 'app.shopify.myshopify.io'
    case 'spin':
      return `app.shopify.${await spinFqdn()}`
    default:
      return productionFqdn
  }
}

/**
 * It returns the BusinessPlatform' API service we should interact with.
 *
 * @returns Fully-qualified domain of the partners service we should interact with.
 */
export async function businessPlatformFqdn(): Promise<string> {
  const environment = serviceEnvironment()
  const productionFqdn = 'destinations.shopifysvc.com'
  switch (environment) {
    case 'local':
      return 'business-platform.myshopify.io'
    case 'spin':
      return `business-platform.${await spinFqdn()}`
    default:
      return productionFqdn
  }
}

/**
 * It returns the Identity service we should interact with.
 *
 * @returns Fully-qualified domain of the Identity service we should interact with.
 */
export async function identityFqdn(): Promise<string> {
  const environment = serviceEnvironment()
  const productionFqdn = 'accounts.shopify.com'
  switch (environment) {
    case 'local':
      return 'identity.myshopify.io'
    case 'spin':
      return `identity.${await spinFqdn()}`
    default:
      return productionFqdn
  }
}

/**
 * Normalize the store name to be used in the CLI.
 * It will add the .myshopify.com domain if it's not present.
 * It will add the spin domain if it's not present and we're in a Spin environment.
 *
 * @param store - Store name.
 * @returns Normalized store name.
 */
export async function normalizeStoreFqdn(store: string): Promise<string> {
  const storeFqdn = store.replace(/^https?:\/\//, '').replace(/\/$/, '')
  const addDomain = async (storeFqdn: string) =>
    isSpinEnvironment() ? `${storeFqdn}.shopify.${await spinFqdn()}` : `${storeFqdn}.myshopify.com`
  const containDomain = (storeFqdn: string) => storeFqdn.includes('.myshopify.com') || storeFqdn.includes('spin.dev')
  return containDomain(storeFqdn) ? storeFqdn : addDomain(storeFqdn)
}
