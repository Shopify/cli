import {gql} from 'graphql-request'

export const AllStoresByOrganizationQuery = gql`
  query FindOrganization($id: ID!) {
    organizations(id: $id, first: 1) {
      nodes {
        id
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
      }
    }
  }
`

export interface AllStoresByOrganizationSchema {
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
