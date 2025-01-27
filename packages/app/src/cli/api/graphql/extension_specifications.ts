import {gql} from 'graphql-request'

export const ExtensionSpecificationsQuery = gql`
  query fetchSpecifications($api_key: String!) {
    extensionSpecifications(apiKey: $api_key) {
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
  api_key: string
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
