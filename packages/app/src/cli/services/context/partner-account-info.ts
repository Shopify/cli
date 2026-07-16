import {CurrentAccountInfoQuery} from '../../api/graphql/partners/generated/current-account-info.js'
import {getCachedAccountInfo, setCachedAccountInfo} from '../../utilities/app-conf-store.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {AccountInfo} from '@shopify/cli-kit/node/session'

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

async function getCurrentAccountInfo(developerPlatformClient: DeveloperPlatformClient): Promise<AccountInfo> {
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
