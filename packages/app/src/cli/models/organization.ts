import {SpecsAppConfiguration} from './extensions/specifications/types/app_config.js'
import {Flag} from '../services/dev/fetch.js'

export interface Organization {
  id: string
  businessName: string
  website?: string
}

export interface MinimalAppIdentifiers {
  id: string
  apiKey: string
  organizationId: string
}

export type MinimalOrganizationApp = MinimalAppIdentifiers & {
  title: string
}

export type OrganizationApp = MinimalOrganizationApp & {
  apiSecretKeys: {
    secret: string
  }[]
  appType?: string
  newApp?: boolean
  grantedScopes: string[]
  developmentStorePreviewEnabled?: boolean
  configuration?: SpecsAppConfiguration
  flags: Flag[]
}

export interface OrganizationStore {
  shopId: string
  link: string
  shopDomain: string
  shopName: string
  transferDisabled: boolean
  convertableToPartnerTest: boolean
}
