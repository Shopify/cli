import {gql} from 'graphql-request'

export interface OrganizationsQuerySchema {
  organizations: {nodes: Organization[]}
}

export interface Organization {
  id: string
  businessName: string
  website: string
  stores: {nodes: OrganzationStore[]}
  apps: {nodes: OrganizationApp[]}
}

export interface OrganizationApp {
  id: string
  title: string
  apiKey: string
  apiSecretKeys: any
}

export interface OrganzationStore {
  shopId: string
  link: string
  shopDomain: string
  shopName: string
  transferDisabled: boolean
  convertableToPartnerTest: boolean
}

export const OrganizationsQuery = `
  {
    organizations {
      nodes {
        id
        businessName
        website
        stores(first: 500) {
          nodes {
            shopId
            link
            shopDomain
            shopName
            transferDisabled
            convertableToPartnerTest
          }
        }
        apps(first: 500) {
          nodes {
            id
            title
            apiKey
            apiSecretKeys {
              secret
            }
            appType
          }
        }
      }
    }
  }
`
