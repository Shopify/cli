import {gql} from 'graphql-request'

export const OrganizationQuery = gql`
  query FindOrganizations($organizationId: OrganizationID!) {
    currentUserAccount {
      organization(id: $organizationId) {
        id
        name
      }
    }
  }
`

export interface OrganizationQueryVariables {
  organizationId: string
}

export interface OrganizationQuerySchema {
  currentUserAccount: {
    organization: {
      id: string
      name: string
    } | null
  }
}
