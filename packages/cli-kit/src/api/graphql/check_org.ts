import {gql} from 'graphql-request'

export interface CheckOrganizationQuerySchemaOrganization {
  id: string
}

export interface CheckOrganizationQuerySchema {
  organizations: {
    nodes: CheckOrganizationQuerySchemaOrganization[]
  }
}

export const CheckOrganizationsQuery = gql`
  {
    organizations(first: 1) {
      nodes {
        id
      }
    }
  }
`
