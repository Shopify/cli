import {geCurrentAccountInfo} from '../../api/graphql/current_account_info.js'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'

export interface PartnersSession {
  token: string
  accountInfo: AccountInfo
}

export abstract class AccountInfo {
  isUserAccount(): this is UserAccountInfo {
    return false
  }

  isServiceAccount(): this is ServiceAccountInfo {
    return false
  }

  isUnknownAccount(): this is UnknownAccountInfo {
    return false
  }
}

export class UserAccountInfo extends AccountInfo {
  email: string

  constructor(email: string) {
    super()
    this.email = email
  }

  isUserAccount() {
    return true
  }
}

export class ServiceAccountInfo extends AccountInfo {
  orgName: string

  constructor(orgName: string) {
    super()
    this.orgName = orgName
  }

  isServiceAccount(): this is ServiceAccountInfo {
    return true
  }
}

export class UnknownAccountInfo extends AccountInfo {
  constructor() {
    super()
  }

  isUnknownAccount(): this is UnknownAccountInfo {
    return true
  }
}

export async function fetchPartnersSession(): Promise<PartnersSession> {
  const token = await ensureAuthenticatedPartners()
  return {
    token,
    accountInfo: await fetchCurrentAccountInformation(token),
  }
}

async function fetchCurrentAccountInformation(token: string) {
  try {
    return await geCurrentAccountInfo(token)
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    outputDebug('Error fetching user account info')
    return new UnknownAccountInfo()
  }
}
