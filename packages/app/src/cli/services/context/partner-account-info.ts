import {getCurrentAccountInfo} from '../../api/graphql/current_account_info.js'
import {getCachedAccountInfo, setCachedAccountInfo} from '../../utilities/app-conf-store.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
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
