import {gql} from 'graphql-request'

export const DevStoresQuery = gql`
  query ListDevStores($organizationId: OrganizationID!) {
    organization(organizationId: $organizationId) {
      id
      properties(offeringHandles: ["shop"]) {
        edges {
          node {
            id
            externalId
            ... on Shop {
              name
              hasPendingTransfer
              primaryDomain
              storeType
              shortName
            }
          }
        }
      }
    }
  }
`

export interface DevStoresQueryVariables {
  organizationId: string
}

export interface DevStoresQuerySchema {
  organization: {
    id: string
    properties: {
      edges: {
        node: {
          id: string
          externalId: string
          name: string
          hasPendingTransfer: boolean
          primaryDomain: string
          storeType: string
          shortName: string
        }
      }[]
    }
  }
}
