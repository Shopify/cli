import {gql} from 'graphql-request'

export const FindStoreByDomainQuery = gql`
  query FindOrganization($orgId: ID!, $shopDomain: String) {
    organizations(id: $orgId, first: 1) {
      nodes {
        id
        businessName
        stores(shopDomain: $shopDomain, first: 1, archived: false) {
          nodes {
            shopId
            link
            shopDomain
            shopName
            transferDisabled
            convertableToPartnerTest
          }
        }
      }
    }
  }
`

export interface FindStoreByDomainQueryVariables {
  orgId: string
  shopDomain: string
}

export interface FindStoreByDomainSchema {
  organizations: {
    nodes: {
      id: string
      businessName: string
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
    }[]
  }
}
