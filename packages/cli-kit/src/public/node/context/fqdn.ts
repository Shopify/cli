import {AbortError, BugError} from '../error.js'
import {serviceEnvironment} from '../../../private/node/context/service.js'
import {DevServer, DevServerCore} from '../vendor/dev_server/index.js'
import {blockPartnersAccess} from '../environment.js'

export const NotProvidedStoreFQDNError = new AbortError(
  "Couldn't obtain the Shopify FQDN because the store FQDN was not provided.",
)

/**
 * It returns the Partners' API service we should interact with.
 *
 * @returns Fully-qualified domain of the partners service we should interact with.
 */
export async function partnersFqdn(): Promise<string> {
  if (blockPartnersAccess()) {
    throw new BugError('Partners API is is no longer available.')
  }
  const environment = serviceEnvironment()
  const productionFqdn = 'partners.shopify.com'
  switch (environment) {
    case 'local':
      return new DevServer('partners').host()
    default:
      return productionFqdn
  }
}

/**
 * It returns the Admin service we should interact with.
 *
 * @returns Fully-qualified domain of the Admin service we should interact with.
 */
export async function adminFqdn(): Promise<string> {
  const environment = serviceEnvironment()
  const productionFqdn = 'admin.shopify.com'
  switch (environment) {
    case 'local':
      return new DevServerCore().host('admin')
    default:
      return productionFqdn
  }
}

/**
 * It returns the App Management API service we should interact with.
 *
 * @returns Fully-qualified domain of the App Management service we should interact with.
 */
export async function appManagementFqdn(): Promise<string> {
  const environment = serviceEnvironment()
  const productionFqdn = 'app.shopify.com'
  switch (environment) {
    case 'local':
      return new DevServerCore().host('app')
    default:
      return productionFqdn
  }
}

/**
 * It returns the App Dev API service we should interact with.
 *
 * @param storeFqdn - The store FQDN.
 * @returns Fully-qualified domain of the App Dev service we should interact with.
 */
export async function appDevFqdn(storeFqdn: string): Promise<string> {
  const environment = serviceEnvironment()
  switch (environment) {
    case 'local':
      return new DevServerCore().host('app')
    default:
      return storeFqdn
  }
}
/**
 * It returns the Developer Dashboard domain we should interact with.
 *
 * @returns Fully-qualified domain of the Developer Dashboard we should interact with.
 */
export async function developerDashboardFqdn(): Promise<string> {
  const environment = serviceEnvironment()
  const productionFqdn = 'dev.shopify.com'
  switch (environment) {
    case 'local':
      return new DevServerCore().host('dev')
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
      return new DevServer('business-platform').host()
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
      return new DevServer('identity').host()
    default:
      return productionFqdn
  }
}

/**
 * Normalize the store name to be used in the CLI.
 * It will add the .myshopify.com domain if it's not present.
 *
 * @param store - Store name.
 * @returns Normalized store name.
 */
export function normalizeStoreFqdn(store: string): string {
  const storeFqdn = store
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
    .replace(/\/admin$/, '')
  const addDomain = (storeFqdn: string) => {
    switch (serviceEnvironment()) {
      case 'local':
        return new DevServerCore().host(storeFqdn)
      default:
        return `${storeFqdn}.myshopify.com`
    }
  }
  const containDomain = (storeFqdn: string) =>
    storeFqdn.endsWith('.myshopify.com') || storeFqdn.endsWith('shopify.io') || storeFqdn.endsWith('.shop.dev')
  return containDomain(storeFqdn) ? storeFqdn : addDomain(storeFqdn)
}
