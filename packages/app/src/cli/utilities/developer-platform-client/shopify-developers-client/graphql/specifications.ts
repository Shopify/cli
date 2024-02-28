import {ExtensionSpecification} from '../../../../models/extensions/specification.js'
import {gql} from 'graphql-request'

export const SpecificationsQuery = gql`
  query fetchSpecifications($appId: ID!) {
    specifications(appId: $appId) {
      name
      externalIdentifier
      identifier
      experience
      features
      schema
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
  schema: ExtensionSpecification['schema']
}

export interface SpecificationsQuerySchema {
  specifications: RemoteSpecification[]
}
