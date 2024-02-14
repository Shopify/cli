import {PartnersClient} from './developer-platform-client/partners-client.js'
import {PartnersSession} from '../../cli/services/context/partner-account-info.js'
import {OrganizationApp} from '../models/organization.js'

export function selectDeveloperPlatformClient(): DeveloperPlatformClient {
  return new PartnersClient()
}

export interface DeveloperPlatformClient {
  session: () => Promise<PartnersSession>
  appFromId: (appId: string) => Promise<OrganizationApp>
}
