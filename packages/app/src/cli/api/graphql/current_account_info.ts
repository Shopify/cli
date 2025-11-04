import {CurrentAccountInfoQuery} from './partners/generated/current-account-info.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {AccountInfo} from '@shopify/cli-kit/node/session'
import {AbortError} from '@shopify/cli-kit/node/error'

export type CurrentAccountInfoSchema = CurrentAccountInfoQuery

export async function getCurrentAccountInfo(developerPlatformClient: DeveloperPlatformClient) {
  const {currentAccountInfo} = await developerPlatformClient.currentAccountInfo()

  if (!currentAccountInfo) {
    throw new AbortError('Unable to get current user account')
  }

  return mapAccountInfo(currentAccountInfo)
}

function mapAccountInfo(accountInfo: CurrentAccountInfoQuery['currentAccountInfo']): AccountInfo {
  if (accountInfo.__typename === 'UserAccount') {
    return {
      type: 'UserAccount',
      email: accountInfo.email,
    }
  } else if (accountInfo.__typename === 'ServiceAccount') {
    return {
      type: 'ServiceAccount',
      orgName: accountInfo.orgName,
    }
  } else {
    return {type: 'UnknownAccount'}
  }
}
