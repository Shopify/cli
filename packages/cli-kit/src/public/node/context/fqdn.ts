/* eslint-disable @typescript-eslint/switch-exhaustiveness-check -- all switches branch on Environment.Local vs default (production) */
import {AbortError} from '../error.js'
import {serviceEnvironment} from '../../../private/node/context/service.js'
import {DevServer, DevServerCore} from '../vendor/dev_server/index.js'

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
  const storeFqdn = parseStoreFqdn(store)

  assertValidStoreFqdn(storeFqdn, store)

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

const invalidStoreFqdnTryMessage =
  'Provide a store handle or Shopify store domain, for example "example" or "example.myshopify.com". ' +
  'Store URLs may only include the optional /admin path.'

function parseStoreFqdn(store: string): string {
  const trimmedStore = store.trim()

  if (trimmedStore.startsWith('/')) {
    throw new AbortError(`Invalid store value: ${store}`, invalidStoreFqdnTryMessage)
  }

  const storeUrl = parseSupportedStoreUrl(
    /^https?:\/\//i.test(trimmedStore) ? trimmedStore : `https://${trimmedStore}`,
    store,
  )
  return storeUrl.hostname
}

function parseSupportedStoreUrl(store: string, originalStore: string): URL {
  let storeUrl: URL
  try {
    storeUrl = new URL(store)
  } catch {
    throw new AbortError(`Invalid store value: ${originalStore}`, invalidStoreFqdnTryMessage)
  }

  const supportedPath = storeUrl.pathname === '/' || storeUrl.pathname === '/admin' || storeUrl.pathname === '/admin/'
  if (
    !storeUrl.hostname ||
    storeUrl.username ||
    storeUrl.password ||
    storeUrl.port ||
    storeUrl.search ||
    storeUrl.hash ||
    !supportedPath
  ) {
    throw new AbortError(`Invalid store value: ${originalStore}`, invalidStoreFqdnTryMessage)
  }

  return storeUrl
}

function assertValidStoreFqdn(storeFqdn: string, store: string) {
  if (storeFqdn.length === 0 || storeFqdn.length > 253) {
    throw new AbortError(`Invalid store value: ${store}`, invalidStoreFqdnTryMessage)
  }

  const domainLabels = storeFqdn.split('.')
  const validStoreDomainLabel = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i
  const validDomain = domainLabels.every((label) => {
    return label.length > 0 && label.length <= 63 && validStoreDomainLabel.test(label)
  })

  if (!validDomain) {
    throw new AbortError(`Invalid store value: ${store}`, invalidStoreFqdnTryMessage)
  }
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
