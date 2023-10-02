import {getUserAccount} from '../../api/graphql/user_account.js'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {ensureAuthenticatedBusinessPlatform, ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'

export interface PartnersSession {
  token: string
  accountInfo: {
    email: string
  }
}

export async function fetchPartnersSession(): Promise<PartnersSession> {
  const token = await ensureAuthenticatedPartners()
  const parternsSession = {token, accountInfo: {email: ''}}
  try {
    const tokenBusinessPlatform = await ensureAuthenticatedBusinessPlatform()
    const userAccount = await getUserAccount(tokenBusinessPlatform)
    parternsSession.accountInfo.email = userAccount.email
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    outputDebug('Error fetching user account info')
  }
  return parternsSession
}
