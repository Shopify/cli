import {gql} from 'graphql-request'

export const ListDevStoresQuery = gql`
  query ListAppDevStores {
    organization {
      id
      name
      properties(filters: {field: STORE_TYPE, operator: EQUALS, value: "production"}, offeringHandles: ["shop"]) {
        edges {
          node {
            id
            externalId
            ... on Shop {
              name
              storeType
              primaryDomain
              shortName
            }
          }
        }
      }
    }
  }
`

export interface ListDevStoresQuerySchema {
  organization: {
    id: string
    name: string
    properties: {
      edges: {
        node: {
          id: string
          externalId: string
          name: string
          primaryDomain: string
          storeType: string
          shortName: string
        }
      }[]
    }
  }
}

export interface DevStoreType {
  node: {
    id: string
    externalId: string
    name: string
    primaryDomain: string
    storeType: string
    shortName: string
  }
}
