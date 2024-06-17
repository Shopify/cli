import {gql} from 'graphql-request'

export const DevStoreByDomainQuery = gql`
  query DevStoreByDomain($organizationId: OrganizationID!, $domain: String!) {
    organization(organizationId: $organizationId) {
      id
      name
      properties(offeringHandles: ["shop"], search: $domain) {
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

export interface DevStoreByDomainQueryVariables {
  organizationId: string
  domain: string
}

export interface DevStoreByDomainQuerySchema {
  organization: {
    id: string
    name: string
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
