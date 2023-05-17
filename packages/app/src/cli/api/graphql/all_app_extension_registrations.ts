import {gql} from 'graphql-request'

export const AllAppExtensionRegistrationsQuery = gql`
  query allAppExtensionRegistrations($apiKey: String!) {
    app(apiKey: $apiKey) {
      extensionRegistrations {
        id
        uuid
        title
        type
      }
      dashboardManagedExtensionRegistrations {
        id
        uuid
        title
        type
      }
      functions {
        id
        uuid
        title
        type: apiType
      }
    }
  }
`

export interface AllAppExtensionRegistrationsQueryVariables {
  apiKey: string
}

interface ExtensionRegistration {
  id: string
  uuid: string
  title: string
  type: string
}

export interface AllAppExtensionRegistrationsQuerySchema {
  app: {
    extensionRegistrations: ExtensionRegistration[]
    dashboardManagedExtensionRegistrations: ExtensionRegistration[]
    functions: ExtensionRegistration[]
  }
}
