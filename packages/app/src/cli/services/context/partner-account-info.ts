import {getCachedAccountInfo} from '../../utilities/app-conf-store.js'
import {outputDebug} from '@shopify/cli-kit/node/output'

export interface PartnersSession {
  token: string
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

export async function fetchCurrentAccountInformation(subject: string): Promise<AccountInfo> {
  const cachedInfo = getCachedAccountInfo(subject)

  if (cachedInfo) {
    outputDebug('Getting partner account info from cache')
    return cachedInfo
  }

  return {type: 'UnknownAccount'}
}
