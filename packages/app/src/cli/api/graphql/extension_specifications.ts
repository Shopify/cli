import {gql} from 'graphql-request'

export const ExtensionSpecificationsQuery = gql`
  query fetchSpecifications($apiKey: String!) {
    extensionSpecifications(apiKey: $apiKey) {
      name
      externalName
      externalIdentifier
      identifier
      gated
      experience
      options {
        managementExperience
        registrationLimit
      }
      features {
        argo {
          surface
        }
      }
      validationSchema {
        jsonSchema
      }
    }
  }
`

export interface ExtensionSpecificationsQueryVariables {
  apiKey: string
}

export interface RemoteSpecification {
  name: string
  externalName: string
  identifier: string
  gated: boolean
  externalIdentifier: string
  experience: 'extension' | 'configuration' | 'deprecated'
  options: {
    managementExperience: 'cli' | 'custom' | 'dashboard'
    registrationLimit: number
    uidIsClientProvided: boolean
  }
  features?: {
    argo?: {
      surface: string
    }
  }
  validationSchema?: {
    jsonSchema: string
  } | null
}

export interface FlattenedRemoteSpecification extends RemoteSpecification {
  surface?: string
  registrationLimit: number
}

export interface ExtensionSpecificationsQuerySchema {
  extensionSpecifications: RemoteSpecification[]
}
