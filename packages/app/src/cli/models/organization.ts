export interface Organization {
  id: string
  businessName: string
  website?: string
}

export interface MinimalOrganizationApp {
  id: string
  title: string
  apiKey: string
}

export type OrganizationApp = MinimalOrganizationApp & {
  organizationId: string
  apiSecretKeys: {
    secret: string
  }[]
  appType?: string
  newApp?: boolean
  grantedScopes: string[]
  betas?: {
    declarativeWebhooks?: boolean
  }
  applicationUrl: string
  redirectUrlWhitelist: string[]
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
  developmentStorePreviewEnabled?: boolean
  disabledBetas?: string[]
}

export interface OrganizationStore {
  shopId: string
  link: string
  shopDomain: string
  shopName: string
  transferDisabled: boolean
  convertableToPartnerTest: boolean
}
