import {gql} from 'graphql-request'

export const FindOrganizationQuery = gql`
  query FindOrganization($id: ID!) {
    organizations(id: $id, first: 1) {
      nodes {
        id
        businessName
        website
        appsNext
        apps(first: 100) {
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
      appsNext: boolean
      apps: {
        nodes: {
          id: string
          title: string
          apiKey: string
        }[]
      }
    }[]
  }
}
