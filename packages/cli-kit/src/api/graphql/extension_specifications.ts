import {gql} from 'graphql-request'

export const ExtensionSpecificationsQuery = gql`
  query fetchSpecifications($api_key: String!) {
    extensionSpecifications(apiKey: $api_key) {
      name
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
  // eslint-disable-next-line @typescript-eslint/naming-convention
  api_key: string
}

export interface ExtensionSpecificationsQuerySchema {
  extensionSpecifications: {
    name: string
    identifier: string
    gated: boolean
    options: {
      managementExperience: 'cli' | 'custom' | 'dashboard'
      registrationLimit: number
    }
    features?: {
      argo?: {
        surface: string
      }
    }
  }[]
}
