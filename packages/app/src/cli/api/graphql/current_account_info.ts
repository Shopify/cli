import {AccountInfo} from '../../services/context/partner-account-info.js'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'
import {AbortError} from '@shopify/cli-kit/node/error'
import {gql} from 'graphql-request'

const CurrentAccountInfoQuery = gql`
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
