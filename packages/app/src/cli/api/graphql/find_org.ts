import {gql} from 'graphql-request'

export const FindOrganizationQuery = gql`
  query FindOrganization($id: ID!, $title: String) {
    organizations(id: $id, first: 1) {
      nodes {
        id
        businessName
        website
        apps(first: 25, title: $title) {
          pageInfo {
            hasNextPage
          }
          nodes {
            id
            title
            apiKey
          }
        }
      }
    }
  }
`

export interface FindOrganizationQuerySchema {
  organizations: {
    nodes: {
      id: string
      businessName: string
      website: string
      apps: {
        pageInfo: {
          hasNextPage: boolean
        }
        nodes: {
          id: string
          title: string
          apiKey: string
        }[]
      }
    }[]
  }
}
