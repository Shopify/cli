import {gql} from 'graphql-request'

export const OrganizationsQuery = gql`
  query ListOrganizations {
    currentUserAccount {
      uuid
      organizations {
        nodes {
          id
          name
        }
      }
    }
  }
`

export interface OrganizationsQuerySchema {
  currentUserAccount: {
    uuid: string
    organizations: {
      nodes: {
        id: string
        name: string
      }[]
    }
  }
}
