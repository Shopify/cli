import {gql} from 'graphql-request'

export const SpecificationsQuery = gql`
  query fetchSpecifications {
    specifications {
      name
      identifier
      externalIdentifier
      features
    }
  }
`

interface RemoteSpecification {
  name: string
  identifier: string
  externalIdentifier: string
  features?: string[]
}

export interface SpecificationsQuerySchema {
  specifications: RemoteSpecification[]
}
