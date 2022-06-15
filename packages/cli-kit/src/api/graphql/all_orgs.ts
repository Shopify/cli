import {gql} from 'graphql-request'

export interface AllOrganizationsQuerySchema {
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
          apiSecretKeys: {
            secret: string
          }[]
          appType: string
        }[]
      }
    }[]
  }
}

export const AllOrganizationsQuery = gql`
  {
    organizations(first: 200) {
      nodes {
        id
        businessName
        website
        appsNext
        apps {
          nodes {
            id
            title
            apiKey
            apiSecretKeys {
              secret
            }
            appType
          }
        }
      }
    }
  }
`
