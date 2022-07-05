import {gql} from 'graphql-request'

export const FindStoreByDomainQuery = gql`
  query FindOrganization($id: ID!, $shopDomain: String) {
    organizations(id: $id, first: 1) {
      nodes {
        id
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

export interface FindStoreByDomainSchema {
  organizations: {
    nodes: {
      id: string
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
