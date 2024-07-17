import {gql} from 'graphql-request'

export const FetchDevStoreByDomainQuery = gql`
  query FetchDevStoreByDomain($organizationId: OrganizationID!, $domain: String!) {
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

export interface FetchDevStoreByDomainQueryVariables {
  organizationId: string
  domain: string
}

export interface FetchDevStoreByDomainQuerySchema {
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
