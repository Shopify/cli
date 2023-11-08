import {geCurrentAccountInfo} from '../../api/graphql/current_account_info.js'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'

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

export function isUnknownAccount(account: AccountInfo): account is UnknownAccountInfo {
  return account.type === 'UnknownAccount'
}

export async function fetchPartnersSession(): Promise<PartnersSession> {
  const token = await ensureAuthenticatedPartners()
  return {
    token,
    accountInfo: await fetchCurrentAccountInformation(token),
  }
}

async function fetchCurrentAccountInformation(token: string): Promise<AccountInfo> {
  try {
    return await geCurrentAccountInfo(token)
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    outputDebug('Error fetching user account info')
    return {type: 'UnknownAccount'}
  }
}
