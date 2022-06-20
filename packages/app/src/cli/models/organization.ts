export interface Organization {
  id: string
  businessName: string
  website?: string
  appsNext: boolean
}

export interface OrganizationApp {
  id: string
  title: string
  apiKey: string
  organizationId: string
  apiSecretKeys: {
    secret: string
  }[]
  appType?: string
}

export interface OrganizationStore {
  shopId: string
  link: string
  shopDomain: string
  shopName: string
  transferDisabled: boolean
  convertableToPartnerTest: boolean
}
