import {SpecsAppConfiguration} from './extensions/specifications/types/app_config.js'
import {Flag} from '../services/dev/fetch.js'
import {DeveloperPlatformClient} from '../utilities/developer-platform-client.js'

export enum OrganizationSource {
  Partners = 'Partners',
  BusinessPlatform = 'BusinessPlatform',
}

export interface Organization {
  id: string
  businessName: string
  website?: string
  source?: OrganizationSource
}

export interface MinimalAppIdentifiers {
  id: string
  apiKey: string
  organizationId: string
}

export type MinimalOrganizationApp = MinimalAppIdentifiers & {
  title: string
}
export interface MinimalRunEvent {
  type: 'function-run'
  payload: {
    input: string
    invocationId: string
  }
}

export type OrganizationApp = MinimalOrganizationApp & {
  apiSecretKeys: {
    secret: string
  }[]
  appType?: string
  newApp?: boolean
  grantedScopes: string[]
  developmentStorePreviewEnabled?: boolean
  applicationUrl?: string
  redirectUrlWhitelist?: string[]
  requestedAccessScopes?: string[]
  webhookApiVersion?: string
  embedded?: boolean
  posEmbedded?: boolean
  preferencesUrl?: string
  gdprWebhooks?: {
    customerDeletionUrl?: string
    customerDataRequestUrl?: string
    shopDeletionUrl?: string
  }
  appProxy?: {
    subPath: string
    subPathPrefix: string
    url: string
  }
  configuration?: SpecsAppConfiguration
  flags: Flag[]
  developerPlatformClient?: DeveloperPlatformClient
}

export interface OrganizationStore {
  shopId: string
  link: string
  shopDomain: string
  shopName: string
  transferDisabled: boolean
  convertableToPartnerTest: boolean
}
