import {gql} from 'graphql-request'

export const ExtensionSpecificationsQuery = gql`
  query fetchSpecifications($api_key: String!) {
    extensionSpecifications(apiKey: $api_key) {
      name
      externalName
      externalIdentifier
      identifier
      gated
      options {
        managementExperience
        registrationLimit
      }
      features {
        argo {
          surface
        }
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
  options: {
    managementExperience: 'cli' | 'custom' | 'dashboard'
    registrationLimit: number
  }
  features?: {
    argo?: {
      surface: Surface
    }
  }
}

type Surface = 'admin' | 'checkout' | 'post-checkout' | 'pos' | 'customer-accounts' | 'all' | null | undefined

export interface FlattenedRemoteSpecification extends RemoteSpecification {
  surface: Surface
  registrationLimit: number
}

export interface ExtensionSpecificationsQuerySchema {
  extensionSpecifications: RemoteSpecification[]
}
