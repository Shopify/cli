import {gql} from 'graphql-request'

interface AllOrganizationsQuerySchemaOrganization {
  id: string
  businessName: string
  website?: string
}

export interface AllOrganizationsQuerySchema {
  organizations: {
    nodes: AllOrganizationsQuerySchemaOrganization[]
  }
}

export const AllOrganizationsQuery = gql`
  {
    organizations(first: 200) {
      nodes {
        id
        businessName
        website
      }
    }
  }
`
