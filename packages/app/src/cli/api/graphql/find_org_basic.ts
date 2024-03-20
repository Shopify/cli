import {gql} from 'graphql-request'

export const FindOrganizationBasicQuery = gql`
  query FindOrganization($id: ID!) {
    organizations(id: $id, first: 1) {
      nodes {
        id
        businessName
        website
      }
    }
  }
`

export interface FindOrganizationBasicQuerySchema {
  organizations: {
    nodes: {
      id: string
      businessName: string
      website: string
    }[]
  }
}

export interface FindOrganizationBasicVariables {
  id: string
}
