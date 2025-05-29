import {getCurrentAccountInfo} from '../../api/graphql/current_account_info.js'
import {getCachedAccountInfo, setCachedAccountInfo} from '../../utilities/app-conf-store.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {outputDebug} from '@shopify/cli-kit/node/output'

export interface PartnersSession {
  token: string
  businessPlatformToken: string
  accountInfo: AccountInfo
  userId: string
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

export function getAlias(account: AccountInfo): string | undefined {
  if (isUserAccount(account)) {
    return account.email
  }
  if (isServiceAccount(account)) {
    return account.orgName
  }
  return undefined
}
