import {getCurrentAccountInfo} from '../../api/graphql/current_account_info.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
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
): Promise<AccountInfo> {
  try {
    return await getCurrentAccountInfo(developerPlatformClient)
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    outputDebug('Error fetching user account info')
    return {type: 'UnknownAccount'}
  }
}
