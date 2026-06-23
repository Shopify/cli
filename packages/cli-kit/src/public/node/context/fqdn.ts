/* eslint-disable @typescript-eslint/switch-exhaustiveness-check -- all switches branch on Environment.Local vs default (production) */
import {AbortError} from '../error.js'
import {serviceEnvironment} from '../../../private/node/context/service.js'
import {DevServer, DevServerCore} from '../vendor/dev_server/index.js'

export const NotProvidedStoreFQDNError = new AbortError(
  "Couldn't obtain the Shopify FQDN because the store FQDN was not provided.",
)

let memoizedPartnersFqdn: Promise<string> | undefined
let memoizedAdminFqdn: Promise<string> | undefined
let memoizedAppManagementFqdn: Promise<string> | undefined
let memoizedDeveloperDashboardFqdn: Promise<string> | undefined
let memoizedBusinessPlatformFqdn: Promise<string> | undefined
let memoizedIdentityFqdn: Promise<string> | undefined

/**
 * This function is used to reset the memoized values of the FQDNs.
 * It's only used for testing purposes.
 */
export function _resetFqdns() {
  memoizedPartnersFqdn = undefined
  memoizedAdminFqdn = undefined
  memoizedAppManagementFqdn = undefined
  memoizedDeveloperDashboardFqdn = undefined
  memoizedBusinessPlatformFqdn = undefined
  memoizedIdentityFqdn = undefined
}

/**
 * It returns the Partners' API service we should interact with.
 *
 * @returns Fully-qualified domain of the partners service we should interact with.
 */
export function partnersFqdn(): Promise<string> {
  if (memoizedPartnersFqdn) return memoizedPartnersFqdn
  memoizedPartnersFqdn = (async () => {
    const environment = serviceEnvironment()
    const productionFqdn = 'partners.shopify.com'
    switch (environment) {
      case 'local':
        return new DevServer('partners').host()
      default:
        return productionFqdn
    }
  })()
  return memoizedPartnersFqdn
}

/**
 * It returns the Admin service we should interact with.
 *
 * @returns Fully-qualified domain of the Admin service we should interact with.
 */
export function adminFqdn(): Promise<string> {
  if (memoizedAdminFqdn) return memoizedAdminFqdn
  memoizedAdminFqdn = (async () => {
    const environment = serviceEnvironment()
    const productionFqdn = 'admin.shopify.com'
    switch (environment) {
      case 'local':
        return new DevServerCore().host('admin')
      default:
        return productionFqdn
    }
  })()
  return memoizedAdminFqdn
}

/**
 * It returns the App Management API service we should interact with.
 *
 * @returns Fully-qualified domain of the App Management service we should interact with.
 */
export function appManagementFqdn(): Promise<string> {
  if (memoizedAppManagementFqdn) return memoizedAppManagementFqdn
  memoizedAppManagementFqdn = (async () => {
    const environment = serviceEnvironment()
    const productionFqdn = 'app.shopify.com'
    switch (environment) {
      case 'local':
        return new DevServerCore().host('app')
      default:
        return productionFqdn
    }
  })()
  return memoizedAppManagementFqdn
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
export function developerDashboardFqdn(): Promise<string> {
  if (memoizedDeveloperDashboardFqdn) return memoizedDeveloperDashboardFqdn
  memoizedDeveloperDashboardFqdn = (async () => {
    const environment = serviceEnvironment()
    const productionFqdn = 'dev.shopify.com'
    switch (environment) {
      case 'local':
        return new DevServerCore().host('dev')
      default:
        return productionFqdn
    }
  })()
  return memoizedDeveloperDashboardFqdn
}

/**
 * It returns the BusinessPlatform' API service we should interact with.
 *
 * @returns Fully-qualified domain of the partners service we should interact with.
 */
export function businessPlatformFqdn(): Promise<string> {
  if (memoizedBusinessPlatformFqdn) return memoizedBusinessPlatformFqdn
  memoizedBusinessPlatformFqdn = (async () => {
    const environment = serviceEnvironment()
    const productionFqdn = 'destinations.shopifysvc.com'
    switch (environment) {
      case 'local':
        return new DevServer('business-platform').host()
      default:
        return productionFqdn
    }
  })()
  return memoizedBusinessPlatformFqdn
}

/**
 * It returns the Identity service we should interact with.
 *
 * @returns Fully-qualified domain of the Identity service we should interact with.
 */
export function identityFqdn(): Promise<string> {
  if (memoizedIdentityFqdn) return memoizedIdentityFqdn
  memoizedIdentityFqdn = (async () => {
    const environment = serviceEnvironment()
    const productionFqdn = 'accounts.shopify.com'
    switch (environment) {
      case 'local':
        return new DevServer('identity').host()
      default:
        return productionFqdn
    }
  })()
  return memoizedIdentityFqdn
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
    storeFqdn.endsWith('.myshopify.com') || storeFqdn.endsWith('.myshopify.io') || storeFqdn.endsWith('.shop.dev')
  return containDomain(storeFqdn) ? storeFqdn : addDomain(storeFqdn)
}

/**
 * Convert a store FQDN to the admin URL pattern for local development.
 * In local mode, transforms \{store\}.my.shop.dev to admin.shop.dev/store/\{store\}.
 *
 * @param storeFqdn - Normalized store FQDN.
 * @returns Store admin URL base (without protocol or path).
 */
export function storeAdminUrl(storeFqdn: string): string {
  if (serviceEnvironment() === 'local' && storeFqdn.endsWith('.my.shop.dev')) {
    const storeName = storeFqdn.replace('.my.shop.dev', '')
    return `admin.shop.dev/store/${storeName}`
  }
  return storeFqdn
}
