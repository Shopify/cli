import {gql} from 'graphql-request'

// eslint-disable-next-line @shopify/cli/no-inline-graphql
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

/**
 * Raw shape returned by the GraphQL extensionSpecifications query (Partners API).
 * Has nested `options` and `features` matching the query structure.
 */
export interface RawRemoteSpecification {
  name: string
  externalName: string
  identifier: string
  gated: boolean
  externalIdentifier: string
  experience: 'extension' | 'configuration' | 'deprecated'
  options: {
    managementExperience: 'cli' | 'custom' | 'dashboard'
    registrationLimit: number
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

/**
 * Flattened remote specification used throughout the CLI.
 * Options are flattened to top-level fields to align with ExtensionSpecification.
 */
export interface RemoteSpecification {
  name: string
  externalName: string
  identifier: string
  gated: boolean
  externalIdentifier: string
  experience: 'extension' | 'configuration' | 'deprecated'
  managementExperience: 'cli' | 'custom' | 'dashboard'
  registrationLimit: number
  uidIsClientProvided: boolean
  uidStrategy?: 'single' | 'dynamic' | 'uuid'
  surface?: string
  features?: {
    argo?: {
      surface: string
    }
  }
  validationSchema?: {
    jsonSchema: string
  } | null
}

export interface ExtensionSpecificationsQuerySchema {
  extensionSpecifications: RawRemoteSpecification[]
}
