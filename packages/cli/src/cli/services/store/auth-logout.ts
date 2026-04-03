import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {outputCompleted, outputInfo} from '@shopify/cli-kit/node/output'
import {clearStoredStoreAppSession, getStoredStoreAppSession} from './session.js'

interface StoreAuthLogoutResult {
  store: string
  cleared: boolean
}

export function logoutStoreAuth(store: string): StoreAuthLogoutResult {
  const normalizedStore = normalizeStoreFqdn(store)
  const session = getStoredStoreAppSession(normalizedStore)

  if (!session) {
    return {
      store: normalizedStore,
      cleared: false,
    }
  }

  clearStoredStoreAppSession(normalizedStore)

  return {
    store: normalizedStore,
    cleared: true,
  }
}

export function displayStoreAuthLogout(result: StoreAuthLogoutResult): void {
  if (!result.cleared) {
    outputInfo(`No locally stored store auth found for ${result.store}.`)
    return
  }

  outputCompleted(`Cleared locally stored store auth for ${result.store}.`)
}
