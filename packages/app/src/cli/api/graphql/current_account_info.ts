import {AccountInfo} from '../../services/context/partner-account-info.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {gql} from 'graphql-request'

export const CurrentAccountInfoQuery = gql`
  query currentAccountInfo {
    currentAccountInfo {
      __typename
      ... on ServiceAccount {
        orgName
      }
      ... on UserAccount {
        email
      }
    }
  }
`
interface AccountInfoSchema {
  __typename: string
  email?: string
  orgName?: string
}

export interface CurrentAccountInfoSchema {
  currentAccountInfo: AccountInfoSchema
}

export async function getCurrentAccountInfo(developerPlatformClient: DeveloperPlatformClient) {
  const {currentAccountInfo} = await developerPlatformClient.currentAccountInfo()

  if (!currentAccountInfo) {
    throw new AbortError('Unable to get current user account')
  }

  return mapAccountInfo(currentAccountInfo)
}

function mapAccountInfo(accountInfo: AccountInfoSchema): AccountInfo {
  if (accountInfo.__typename === 'UserAccount') {
    return {
      type: 'UserAccount',
      email: accountInfo.email!,
    }
  } else if (accountInfo.__typename === 'ServiceAccount') {
    return {
      type: 'ServiceAccount',
      orgName: accountInfo.orgName!,
    }
  } else {
    return {type: 'UnknownAccount'}
  }
}
