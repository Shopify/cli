import {getUserAccount} from '../../api/graphql/user_account.js'
import {getPartnersToken} from '@shopify/cli-kit/node/environment'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {ensureAuthenticatedBusinessPlatform, ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'

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
  const emptyAccountInfo = {email: ''}

  // CI token does not have access to the business platform and the user should be prompted to login which breaks the CI
  // workflow
  if (getPartnersToken()) return emptyAccountInfo

  try {
    const tokenBusinessPlatform = await ensureAuthenticatedBusinessPlatform()
    const userAccount = await getUserAccount(tokenBusinessPlatform)
    return {email: userAccount.email}
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    outputDebug('Error fetching user account info')
    return emptyAccountInfo
  }
}
