import {gql} from 'graphql-request'

/* TODO deal with permissions better https://docs.google.com/document/d/1RoR_xkr6gAbXNKs3yeWssU5BcIXBYPaIao-5QHgX3fc/edit#heading=h.7nn4amay3dyy */
/* TODO for more options like pagination/sort/search see https://github.com/Shopify/business-platform/pull/19676#issuecomment-2165895156 */
export const DevStoresQuery = gql`
  query ListAppDevStores {
    organization {
      id
      properties(filters: {field: STORE_TYPE, operator: EQUALS, value: "app_development"}, offeringHandles: ["shop"]) {
        edges {
          node {
            id
            externalId
            ... on Shop {
              name
              storeType
              primaryDomain
              shortName
              identificationSettings {
                internalName
                code
                logoImageUrl
              }
              url
              status
              usersCount
              ownerDetails {
                id
                email
                givenName
                familyName
                avatarUrl
              }
              hasPendingTransfer
            }
          }
        }
        pageInfo {
          startCursor
          endCursor
          hasNextPage
          hasPreviousPage
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
