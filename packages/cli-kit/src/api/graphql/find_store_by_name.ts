import {gql} from 'graphql-request'

export const FindStoreByNameQuery = gql`
  query FindOrganization($id: ID!, $shopName: String) {
    organizations(id: $id, first: 1) {
      nodes {
        id
        stores(shopName: $shopName, first: 1, archived: false) {
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

export interface FindStoreByNameSchema {
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
