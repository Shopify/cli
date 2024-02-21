import {PartnersClient} from './developer-platform-client/partners-client.js'
import {PartnersSession} from '../../cli/services/context/partner-account-info.js'
import {MinimalOrganizationApp, Organization, OrganizationApp, OrganizationStore} from '../models/organization.js'

export type Paginateable<T> = T & {
  hasMorePages: boolean
}

export function selectDeveloperPlatformClient(): DeveloperPlatformClient {
  return new PartnersClient()
}

export interface CreateAppOptions {
  isLaunchable?: boolean
  scopesArray?: string[]
  directory?: string
}

export interface DeveloperPlatformClient {
  session: () => Promise<PartnersSession>
  accountInfo: () => Promise<PartnersSession['accountInfo']>
  appFromId: (appId: string) => Promise<OrganizationApp | undefined>
  organizations: () => Promise<Organization[]>
  selectOrg: () => Promise<Organization>
  orgFromId: (orgId: string) => Promise<Organization>
  orgAndApps: (orgId: string) => Promise<Paginateable<{organization: Organization; apps: MinimalOrganizationApp[]}>>
  appsForOrg: (orgId: string, term?: string) => Promise<Paginateable<{apps: MinimalOrganizationApp[]}>>
  createApp(org: Organization, name: string, options?: CreateAppOptions): Promise<OrganizationApp>
  devStoresForOrg: (orgId: string) => Promise<OrganizationStore[]>
}
