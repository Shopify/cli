import {businessPlatformRequest} from '@shopify/cli-kit/node/api/business-platform'
import {AbortError} from '@shopify/cli-kit/node/error'

const CurrentUserAccountQuery = `#graphql
  query currentUserAccount {
    currentUserAccount {
      email
    }
  }
`

interface CurrentUserAccount {
  email: string
}

export interface UserAccountSchema {
  currentUserAccount: CurrentUserAccount | null
}

export async function getUserAccount(token: string) {
  const {currentUserAccount} = await businessPlatformRequest<UserAccountSchema>(CurrentUserAccountQuery, token)

  if (!currentUserAccount) {
    throw new AbortError('Unable to get current user account')
  }

  return {
    email: currentUserAccount.email,
  }
}
