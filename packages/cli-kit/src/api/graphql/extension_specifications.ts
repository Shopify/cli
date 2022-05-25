import {gql} from 'graphql-request'

export const ExtensionSpecificationsQuery = gql`
  query fetchSpecifications($api_key: String!) {
    extensionSpecifications(apiKey: $api_key) {
      name
      identifier
      options {
        managementExperience
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
  apiKey: string
}

export interface ExtensionSpecificationsQuerySchema {
  extensionSpecifications: {
    name: string
    identifier: string
    options: {
      managementExperience: 'cli' | 'custom' | 'dashboard'
    }[]
    features?: {
      argo?: {
        surface: string
      }
    }
  }[]
}
