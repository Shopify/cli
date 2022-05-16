import {gql} from 'graphql-request'

export const AllStoresByOrganizationQuery = gql`
  query FindOrganization($id: ID!) {
    organizations(id: $id, first: 1) {
      nodes {
        id
        stores {
          nodes {
            shopId
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
          transferDisabled: boolean
          convertableToPartnerTest: boolean
        }[]
      }
    }
  }
}
