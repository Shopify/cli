import {gql} from 'graphql-request'

export const AllAppExtensionRegistrationsQuery = gql`
  query allAppExtensionRegistrations($apiKey: String!) {
    app(apiKey: $apiKey) {
      extensionRegistrations {
        id
        uuid
        title
        type
        draftVersion {
          config
          handle
        }
        activeVersion {
          config
          handle
        }
      }
      dashboardManagedExtensionRegistrations {
        id
        uuid
        title
        type
        activeVersion {
          config
          handle
        }
        draftVersion {
          config
          handle
        }
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

export interface ExtensionRegistration {
  id: string
  uuid: string
  title: string
  type: string
  matchIdentifier?: string
  draftVersion?: {
    config: string
    handle: string
  }
  activeVersion?: {
    config: string
    handle: string
  }
}

export interface AllAppExtensionRegistrationsQuerySchema {
  app: {
    extensionRegistrations: ExtensionRegistration[]
    dashboardManagedExtensionRegistrations: ExtensionRegistration[]
    functions: ExtensionRegistration[]
  }
}
