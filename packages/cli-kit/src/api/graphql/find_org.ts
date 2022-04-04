import {gql} from 'graphql-request'

export const FindOrganizationQuery = gql`
  query FindOrganization($id: ID!) {
    organizations(id: $id, first: 1) {
      nodes {
        id
        businessName
        website
        stores(first: 100) {
          nodes {
            shopId
            link
            shopDomain
            shopName
            transferDisabled
            convertableToPartnerTest
          }
        }
        apps(first: 100) {
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

export interface FindOrganizationQuerySchema {
  organizations: {
    nodes: {
      id: string
      businessName: string
      website: string
      stores: {
        nodes: {
          shopId: string
          link: string
          shopDomain: string
          shopName: string
          transferDisabled: boolean
          convertableToPartnerTest: boolean
        }[]
      }
      apps: {
        nodes: {
          id: string
          title: string
          apiKey: string
          apiSecretKeys: {
            secret: string
          }[]
          appType: string
        }[]
      }
    }[]
  }
}
