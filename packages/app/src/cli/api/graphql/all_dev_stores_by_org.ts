import {gql} from 'graphql-request'

export const AllDevStoresByOrganizationQuery = gql`
  query FindOrganization($id: ID!) {
    organizations(id: $id, first: 1) {
      nodes {
        id
        stores(first: 500, archived: false, type: [DEVELOPMENT, PLUS_SANDBOX]) {
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

export interface AllDevStoresByOrganizationQueryVariables {
  id: string
}

export interface AllDevStoresByOrganizationSchema {
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
