import {ServiceAccountInfo, UnknownAccountInfo, UserAccountInfo} from '../../services/context/partner-account-info.js'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'
import {AbortError} from '@shopify/cli-kit/node/error'

const CurrentAccountInfoQuery = `#graphql
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

interface CurrentAccountInfoSchema {
  currentAccountInfo: AccountInfoSchema
}

export async function geCurrentAccountInfo(token: string) {
  const {currentAccountInfo} = await partnersRequest<CurrentAccountInfoSchema>(CurrentAccountInfoQuery, token)

  if (!currentAccountInfo) {
    throw new AbortError('Unable to get current user account')
  }

  return mapAccountInfo(currentAccountInfo)
}

function mapAccountInfo(accountInfo: AccountInfoSchema) {
  if (accountInfo.__typename === 'UserAccount') {
    return new UserAccountInfo(accountInfo.email!)
  } else if (accountInfo.__typename === 'ServiceAccount') {
    return new ServiceAccountInfo(accountInfo.orgName!)
  } else {
    return new UnknownAccountInfo()
  }
}
