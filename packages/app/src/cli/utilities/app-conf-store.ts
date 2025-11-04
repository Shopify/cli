import {AccountInfo} from '@shopify/cli-kit/node/session'
import {LocalStorage} from '@shopify/cli-kit/node/local-storage'

// max age is 72 hours (3 days)
const MAX_AGE_FOR_ACCOUNT_INFO_STATUS_MS = 3 * 24 * 60 * 60 * 1000

export function getConfigStoreForAccountInfoStatus(cwd?: string) {
  return new LocalStorage<{[subject: string]: {info: AccountInfo; loadedAt: string}}>({
    projectName: 'shopify-app-account-info',
    cwd,
  })
}

export function getCachedAccountInfo(subject: string, cwd?: string) {
  const store = getConfigStoreForAccountInfoStatus(cwd)
  const cached = store.get(subject)
  if (cached) {
    // get age of cached data
    const age = new Date().valueOf() - new Date(cached.loadedAt).valueOf()
    if (age > MAX_AGE_FOR_ACCOUNT_INFO_STATUS_MS) {
      return undefined
    }
    return cached.info
  }
  return undefined
}

export function setCachedAccountInfo(subject: string, accountInfo: AccountInfo, cwd?: string) {
  const store = getConfigStoreForAccountInfoStatus(cwd)
  store.set(subject, {info: accountInfo, loadedAt: new Date().toISOString()})
}

export function clearCachedAccountInfo(cwd?: string) {
  const store = getConfigStoreForAccountInfoStatus(cwd)
  store.clear()
}
