import {gql} from 'graphql-request'

export const SpecificationsQuery = gql`
  query fetchSpecifications($appId: ID!) {
    specifications(appId: $appId) {
      name
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
  externalIdentifier: string
  identifier: string
  experience: 'EXTENSION' | 'CONFIGURATION' | 'DEPRECATED'
  features?: string[]
}

export interface SpecificationsQuerySchema {
  specifications: RemoteSpecification[]
}
