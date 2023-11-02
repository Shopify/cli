import {getUserAccount} from '../../api/graphql/user_account.js'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'

export interface PartnersSession {
  token: string
  accountInfo: AccountInfo
}

interface AccountInfo {
  email: string
}

export async function fetchPartnersSession(): Promise<PartnersSession> {
  const token = await ensureAuthenticatedPartners()
  return {
    token,
    accountInfo: await fetchUserAccountInformation(token),
  }
}

async function fetchUserAccountInformation(token: string) {
  try {
    const userAccount = await getUserAccount(token)
    return {email: userAccount.email}
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    outputDebug('Error fetching user account info')
    return {email: ''}
  }
}
