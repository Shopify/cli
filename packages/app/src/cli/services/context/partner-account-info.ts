import {getCurrentAccountInfo} from '../../api/graphql/current_account_info.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {LocalStorage} from '@shopify/cli-kit/node/local-storage'
import {outputDebug} from '@shopify/cli-kit/node/output'

export interface PartnersSession {
  token: string
  accountInfo: AccountInfo
}

export type AccountInfo = UserAccountInfo | ServiceAccountInfo | UnknownAccountInfo

interface UserAccountInfo {
  type: 'UserAccount'
  email: string
}

interface ServiceAccountInfo {
  type: 'ServiceAccount'
  orgName: string
}

interface UnknownAccountInfo {
  type: 'UnknownAccount'
}

export function isUserAccount(account: AccountInfo): account is UserAccountInfo {
  return account.type === 'UserAccount'
}

export function isServiceAccount(account: AccountInfo): account is ServiceAccountInfo {
  return account.type === 'ServiceAccount'
}

export async function fetchCurrentAccountInformation(
  developerPlatformClient: DeveloperPlatformClient,
  subject: string,
): Promise<AccountInfo> {
  const cachedInfo = getCachedAccountInfo(subject)

  if (cachedInfo) {
    outputDebug('Getting partner account info from cache')
    return cachedInfo
  }

  try {
    const fromApi = await getCurrentAccountInfo(developerPlatformClient)
    setCachedAccountInfo(subject, fromApi)
    return fromApi
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    outputDebug('Error fetching user account info')
    return {type: 'UnknownAccount'}
  }
}

// max age is 72 hours
const MAX_AGE_FOR_ACCOUNT_INFO_STATUS_MS = 72 * 24 * 60 * 60 * 1000

function getConfigStoreForAccountInfoStatus() {
  return new LocalStorage<{[subject: string]: {info: AccountInfo; loadedAt: string}}>({
    projectName: 'shopify-app-account-info',
  })
}

function getCachedAccountInfo(subject: string) {
  const store = getConfigStoreForAccountInfoStatus()
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

function setCachedAccountInfo(subject: string, accountInfo: AccountInfo) {
  const store = getConfigStoreForAccountInfoStatus()
  store.set(subject, {info: accountInfo, loadedAt: new Date().toISOString()})
}

export function clearCachedAccountInfo() {
  const store = getConfigStoreForAccountInfoStatus()
  store.clear()
}
