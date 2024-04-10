import {gql} from 'graphql-request'

export const SpecificationsQuery = gql`
  query fetchSpecifications($appId: ID!) {
    specifications(appId: $appId) {
      name
      identifier
      externalIdentifier
      experience
      features
    }
  }
`

export interface SpecificationsQueryVariables {
  appId: string
}

export interface RemoteSpecification {
  name: string
  identifier: string
  externalIdentifier: string
  experience: 'EXTENSION' | 'CONFIGURATION' | 'DEPRECATED'
  features?: string[]
}

export interface SpecificationsQuerySchema {
  specifications: RemoteSpecification[]
}
