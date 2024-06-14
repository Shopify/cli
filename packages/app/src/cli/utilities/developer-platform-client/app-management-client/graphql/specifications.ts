import {gql} from 'graphql-request'

export const SpecificationsQuery = gql`
  query fetchSpecifications($appId: ID!) {
    specifications(appId: $appId) {
      name
      identifier
      externalIdentifier
      features
      appModuleLimit
    }
  }
`

export interface SpecificationsQueryVariables {
  appId: string
}

interface RemoteSpecification {
  name: string
  identifier: string
  externalIdentifier: string
  experience: 'EXTENSION' | 'CONFIGURATION' | 'DEPRECATED'
  features?: string[]
  appModuleLimit: number
}

export interface SpecificationsQuerySchema {
  specifications: RemoteSpecification[]
}
