import {fetchPartnersSession, PartnersSession} from '../../../cli/services/context/partner-account-info.js'
import {fetchAppDetailsFromApiKey} from '../../../cli/services/dev/fetch.js'
import {OrganizationApp} from '../../models/organization.js'
import {AbortError} from '@shopify/cli-kit/node/error'

const resetHelpMessage = ['You can pass', {command: '--reset'}, 'to your command to reset your app configuration.']

export class PartnersClient {
  private _session: PartnersSession | undefined

  async session(): Promise<PartnersSession> {
    if (!this._session) {
      this._session = await fetchPartnersSession()
    }
    return this._session
  }

  async token(): Promise<string> {
    return (await this.session()).token
  }

  async accountInfo(): Promise<PartnersSession['accountInfo']> {
    return (await this.session()).accountInfo
  }

  async appFromId(appId: string): Promise<OrganizationApp> {
    const app = await fetchAppDetailsFromApiKey(appId, await this.token())
    if (!app) throw new AbortError([`Couldn't find the app with Client ID`, {command: appId}], resetHelpMessage)
    return app
  }
}
