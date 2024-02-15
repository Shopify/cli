import {PartnersClient} from './developer-platform-client/partners-client.js'
import {PartnersSession} from '../../cli/services/context/partner-account-info.js'
import {MinimalOrganizationApp, Organization, OrganizationApp} from '../models/organization.js'

export type Paginateable<T> = T & {
  hasMorePages: boolean
}

export function selectDeveloperPlatformClient(): DeveloperPlatformClient {
  return new PartnersClient()
}

export interface DeveloperPlatformClient {
  platformTitle: string
  session: () => Promise<PartnersSession>
  accountInfo: () => Promise<PartnersSession['accountInfo']>
  appFromId: (appId: string) => Promise<OrganizationApp>
  organizations: () => Promise<Organization[]>
  selectOrg: () => Promise<Organization>
  appsForOrg: (orgId: string, term?: string) => Promise<Paginateable<{apps: MinimalOrganizationApp[]}>>
}
